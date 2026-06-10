# The Knowledge System — Design (v1)

Three evolving bodies of knowledge — **General** (methodology), **Vertical** (per industry,
starting with waste collectors), **Client** (per account) — stored as one typed knowledge
graph, fed automatically from filed deal events, promoted upward through a human review
gate, and served to every AI feature according to where the user is standing in the tool.

Decided 2026-06-10 (grill session, Floris + Claude). Each decision below records the
alternatives considered.

---

## 1. Decisions

| # | Question | Decision | Rejected alternatives |
|---|---|---|---|
| 1 | Unit of knowledge | **Typed sales ontology** — fixed node types, typed edges, confidence + provenance | Freeform LLM triples (drift), curated notes (not a graph), hybrid |
| 2 | Client anchor | **Account-level, new `clients` table** (name, vertical, workspace); deals link to clientId | Per-deal graphs (fragments company knowledge), keying by account string (no home for vertical) |
| 3 | Storage shape | **One `knowledge` store + scope discriminator**; the three tiers are filtered views | Three separate stores (promotion = copying, provenance breaks) |
| 4 | Extraction source | **Filed events only** — every substantive `appendEvent` triggers background extraction; chat stays read-only | Mining chat threads (AI-citing-AI loops), manual-only (no background learning) |
| 5 | Write autonomy | **Auto-commit at client scope; human-approved promotion** to vertical/general via review queue, anonymized | Fully automatic (one bad generalization poisons every deal), review-everything (queue chore) |
| 6 | Retrieval | **Scope stack + full serialization** with per-tier token budgets; augments (never replaces) the deal-state JSON | Embeddings/RAG day one (premature), two-step AI selection (latency/cost) |
| 7 | General tier vs library.ts | **Seed general graph from library.ts/manual; standards stay canonical in code/blueprint; general tier grows with approved meta-lessons** | Full migration (doctrine becomes mutable data), lessons-only (can't link lessons to standards) |
| 8 | Lifecycle | **Diff-mode extraction + supersede chains**; staleness surfaced by age, not auto-decay; conflicts → review queue | Append-only (bloat + contradictions), mutable + decay (loses history, arbitrary rates) |
| 9 | Workspaces | **Workspace-scoped knowledge**; sim is seeded + resettable for demos; general tier shared read-only | Live-only (can't showcase), shared pool (sim fiction pollutes real coaching) |
| 10 | Showcase UI | **Dedicated Knowledge page with interactive graph viz + in-context panels** (RecordCard tab, chat citations) | Panels-first (weak demo), viz-only (knowledge separated from work) |

Influences adopted from the Graphify/Obsidian pattern (video, 2026-06): nodes are
**concepts/claims, not documents**; every node is **wired to its origin** (signpost
pattern — here: provenance → event in the timeline); **community clustering** for
readable visualization; optional **markdown export with backlinks** for portability.
Explicitly not adopted: markdown files as storage substrate — Convex is the vault,
the in-app Knowledge UI is our Obsidian.

---

## 2. Ontology

### Node types (8)

| Type | What it captures | Example claim |
|---|---|---|
| `stakeholder` | A person/role at a client: power, disposition, thread strength | "Jan Visser (CFO) is the Economic Buyer; signs >€50K; not yet engaged directly" |
| `pain` | An identified pain, ideally in EUR, with an owner | "Sorting line 2 downtime costs ~€8K/week; owned by ops manager De Wit" |
| `metric` | A baseline/target the value case is built on | "Recyclate recovery baseline 72%, target 80% agreed in PoC" |
| `objection` | A raised objection/risk and its handling state | "IT blocks cloud tools without ISO27001 evidence — open" |
| `process_fact` | Decision/procurement process knowledge | "Procurement requires InfoSec review before any contract >€50K" |
| `lesson` | A learned generalization (the promotable type) | "Collectors with municipal contracts budget in Sept — start ARR paper by June" |
| `play` | A tactic/move that works (or doesn't) | "Site-visit demo personalised on their own line data converts to PoC" |
| `standard` | Seeded doctrine from library.ts/manual (general tier) | "MEDDIC E=4-5 means direct EB relationship, threshold confirmed" |

### Node fields

```ts
knowledge: {
  workspace: "sim" | "live",            // general-tier nodes: "shared"
  scope: { level: "general" } | { level: "vertical", vertical: string }
       | { level: "client", clientId: Id<"clients"> },
  type: NodeType,                        // the 8 above
  title: string,                         // short label (graph display)
  claim: string,                         // one-sentence assertion — the payload
  detail?: string,                       // optional nuance, markdown
  confidence: number,                    // 0..1, set by extractor / 1.0 when approved
  status: "active" | "proposed" | "superseded" | "rejected",
  source: "seeded" | "extracted" | "promoted" | "manual",
  provenance: { eventId?: Id<"events">, dealId?: Id<"deals">, quote?: string }[],
  createdAt: string, lastConfirmedAt: string,
  community?: string,                    // display clustering (computed, cached)
}
```

### Edge types (7)

`relates_to` (generic), `about` (fact → stakeholder), `blocks` / `validates`
(objection/pain ↔ deal progress facts), `supersedes` (new → old, lifecycle),
`generalized_from` (vertical node → source client nodes; general ← vertical),
`refines` (lesson → standard it sharpens).

Edges: `{ source, target, type, note?, createdAt }` in a `knowledgeEdges` table.
Cross-scope edges are allowed and are the promotion/provenance mechanism.

---

## 3. Schema changes (Convex)

- **`clients`** (new): `{ name, vertical, workspace, createdAt }`, index by workspace.
  Backfill migration: one client per distinct `deals.account` per workspace, all
  `vertical: "waste"`. `deals` gets optional `clientId` (kept alongside `account` string).
- **`verticals`** (new, small): `{ id, name, description }` — managed on the Process page;
  seeded with `waste`.
- **`knowledge`** + **`knowledgeEdges`** (new): as above. Indexes: by scope+status,
  by clientId, by workspace.
- **`extractionRuns`** (new, small): log of background extraction jobs
  `{ eventId, status, opsApplied, error?, at }` — observability + retry + idempotency.
- `events` gets optional `interviewTranscript?: string` (guided interview stores its full
  transcript on the filed event for richer extraction).

No changes to the append-only event model itself.

---

## 4. Extraction pipeline (client tier, automatic)

1. `deals.appendEvent` — after insert, for substantive types (`template`, `note` with
   content/evidence, `disposition`, `gate` overrides) — schedules
   `ctx.scheduler.runAfter(0, internal.knowledge.extractFromEvent, { eventId })`.
2. `extractFromEvent` (internal action):
   - Loads the event (payload, note, evidenceText, transcript, provenance), the deal,
     the client, and the client's **active** knowledge nodes.
   - One Gemini call, **diff mode**: "here is what we already know, here is the new
     record — return operations." Output: `{ ops: [{ op: "add"|"confirm"|"update"|"supersede",
     nodeId?, node?, edges? }] }` (JSON mime type, parseJsonLoose).
   - Applies ops via an internal mutation: adds get `source: "extracted"`, confidence
     from the model; `supersede` flips the old node's status and writes a `supersedes`
     edge; `confirm` bumps `lastConfirmedAt`. Contradictions the model can't resolve
     become a `proposed` node pair flagged for review.
   - Logs to `extractionRuns`. Failures are logged, never block filing.
3. Guided interview (`guide.ts`): on finish, the full chat history is saved on the filed
   event (`interviewTranscript`) so extraction sees everything said, not just collected
   field values.

## 5. Promotion engine (vertical + general tiers, gated)

- **Trigger**: Convex cron (weekly) + manual "scan now" button; per vertical.
- **Vertical pass**: loads all client graphs in the vertical (live workspace) + the
  existing vertical graph. Gemini proposes vertical-scope nodes — **anonymized** (no
  client names; "3 of 5 collectors" phrasing) — each with `generalized_from` edges to
  its source client nodes and `status: "proposed"`.
- **General pass**: same mechanic one level up — patterns across verticals / recurring
  method gaps become proposed `lesson` nodes that `refine` seeded `standard` nodes.
- **Review queue** (Knowledge page): approve (status→active, confidence→1.0), edit
  then approve, or reject. Only `active` nodes are ever served to AI features.
- **Leakage rule**: client-scope nodes never appear in another client's context.
  Cross-client signal travels only through approved, anonymized vertical nodes.

## 6. Retrieval — `assembleKnowledge`

One shared helper in `convex/knowledge.ts`:

```
assembleKnowledge({ workspace, vertical?, clientId?, charBudget })
```

- Loads **general** (shared, active) + **vertical** (workspace, active, if vertical given)
  + **client** (if clientId given) nodes.
- Serializes grouped by tier then type, sorted confidence desc / lastConfirmedAt desc,
  annotating staleness (`⚠ not confirmed in 60+ days`) and trimming to per-tier budgets
  (~2k general / 3k vertical / 5k client chars by default).
- Output is a labeled markdown/JSON block appended to the existing prompt context —
  the deal-state JSON from event replay stays the factual backbone; the graph adds
  interpretation (who matters, what hurts, what we've learned, which plays apply).

Wiring:

| Feature | Scope stack |
|---|---|
| `chat.ask` from Board/Standup | general + vertical summaries of active verticals |
| `chat.ask` from a client/record context (UI passes `clientId`) | general + client's vertical + client |
| `chat.standup` / `weeklyReview` | general + vertical |
| `guide.step` | general + vertical + client — client nodes also extend the "ALREADY ON FILE" material so the interview stops re-asking known things |
| `extract.extract` | (later, optional) client stakeholder/metric nodes to improve field mapping |

Chat link grammar gains `[label](knowledge:NODE_ID)` — answers cite the nodes they
used; the UI resolves the link to the node inspector. New system-prompt rule: cite
knowledge nodes when they inform a claim.

## 7. Seeding

- **General tier seeder** (one-time mutation, idempotent): converts `library.ts` —
  MEDDIC rubric rows → `standard` nodes (one per letter), PRINCIPLES → `standard`,
  email templates / site-visit agenda / 3Ys / Value Hypothesis → `play`/`standard`
  nodes, `refines`/`relates_to` edges between them. Marked `source: "seeded"`.
  `library.ts` remains canonical; re-running the seeder updates seeded nodes in place.
- **Sim demo seed**: a curated set of client nodes for the 13 sim deals + a handful of
  waste-vertical lessons (plausible, clearly fictional), so the Simulation workspace
  demos the full loop. `resetScenario` deletes sim-workspace knowledge and re-seeds.

## 8. Knowledge UI

- **Knowledge page** (new top-nav item):
  - Interactive force-layout graph (custom SVG/canvas, ~hundreds of nodes — no heavy
    dependency). Tier lens: General / Vertical / Client selector, mirroring the three
    bodies of knowledge. Node color by type, size by degree, grouped into communities.
  - Node inspector: claim, detail, confidence, freshness, status, provenance links
    (→ opens the source event in the deal timeline), supersede history chain.
  - **Review queue tab**: proposed vertical/general nodes with their
    `generalized_from` sources; approve / edit / reject.
- **RecordCard**: new "Knowledge" tab — this client's graph slice (list + mini-graph)
  and the vertical lessons that currently apply.
- **ChatDock / analyst answers**: footer "what informed this answer" rendering the
  `knowledge:` citations.
- **NewDealModal / Clients**: client picker/creator with vertical assignment.

## 9. Build phases (the to-do list expands these)

1. **Foundations** — schema (clients, verticals, knowledge, knowledgeEdges,
   extractionRuns), account→client backfill, general-tier seeder.
2. **Learning loop** — extraction pipeline on appendEvent, interview transcript
   capture, diff-mode prompt, lifecycle ops.
3. **Serving** — assembleKnowledge + wiring into ask/standup/weeklyReview/guide,
   `knowledge:` link grammar.
4. **Promotion** — cron + proposal generation (anonymized) + review queue backend.
5. **Showcase** — Knowledge page (graph viz, inspector, review queue UI), RecordCard
   tab, chat citations footer, sim demo seed + reset integration.
6. **Later / optional** — markdown export with backlinks (Obsidian-compatible),
   embeddings when a tier outgrows its budget, "save as lesson" button in chat,
   extract.ts enrichment.

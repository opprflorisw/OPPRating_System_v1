# Knowledge System — Build To-Do

> **Status: FINALIZED 2026-06-10 — planning complete, ready to execute.**
> Design rationale and every decision (with rejected alternatives) live in
> [`knowledge-system-design.md`](./knowledge-system-design.md). This file is the
> execution plan: 20 tasks across 5 phases + an optional backlog. Nothing is built
> yet — Phase 1.1 is the first commit of real code.

Companion to `knowledge-system-design.md`. Phases are ordered by dependency; tasks
within a phase are roughly independent. Each task lists the files it touches and a
"done when" check. Work top to bottom; the system is demoable after Phase 3 and
fully showcased after Phase 5.

---

## Phase 1 — Foundations (schema + seeding)

- [ ] **1.1 Schema: new tables**
  `convex/schema.ts`
  Add `clients`, `verticals`, `knowledge`, `knowledgeEdges`, `extractionRuns` per the
  design doc (§2–3). Add optional `clientId` to `deals` and optional
  `interviewTranscript` to `events`.
  *Done when:* `npx convex dev` pushes the schema with no validation errors against
  existing data.

- [ ] **1.2 Verticals seed + client backfill migration**
  `convex/verticals.ts` (new), `convex/migrations.ts` (new)
  Seed `verticals` with `waste`. Migration mutation: for each workspace, create one
  client per distinct `deals.account` (vertical `waste`), stamp `clientId` on its deals.
  Idempotent (safe to re-run).
  *Done when:* every deal in sim + live has a `clientId`; Clients page data unchanged.

- [ ] **1.3 Knowledge CRUD module**
  `convex/knowledge.ts` (new)
  Queries: `byScope`, `forClient`, `proposed` (review queue). Internal mutations:
  `applyOps` (add/confirm/update/supersede with edge writes + status transitions),
  `setStatus` (approve/reject). Enforce the leakage rule in queries (client scope
  filtered by clientId, always).
  *Done when:* unit-style smoke test via Convex dashboard: insert, supersede, query
  by scope all behave; superseded nodes keep their `supersedes` edge.

- [ ] **1.4 General-tier seeder**
  `convex/knowledgeSeed.ts` (new)
  Idempotent mutation converting `library.ts` content → `standard`/`play` nodes with
  `refines`/`relates_to` edges (rubric per letter, PRINCIPLES, email templates,
  site-visit agenda, 3Ys, Value Hypothesis), `source: "seeded"`, workspace `shared`.
  *Done when:* running twice produces no duplicates; ~25–35 general nodes exist.

## Phase 2 — Learning loop (extraction)

- [ ] **2.1 Extraction trigger on appendEvent**
  `convex/deals.ts`
  After insert of substantive events (`template`, `note` with content/evidence,
  `disposition`, override `gate`/`stage` moves), schedule
  `internal.knowledge.extractFromEvent({ eventId })`. Never blocks or fails the filing.
  *Done when:* filing any update creates an `extractionRuns` row.

- [ ] **2.2 Diff-mode extractor action**
  `convex/knowledgeExtract.ts` (new)
  Internal action: load event + deal + client + active client nodes; one Gemini call
  (JSON mime, `parseJsonLoose`) returning ops; apply via `knowledge.applyOps`; log to
  `extractionRuns` (status, opsApplied, error). Prompt rules: claims are one sentence,
  provenance quote required, confidence 0–1, prefer confirm/update/supersede over
  duplicate adds, unresolvable contradictions → `proposed` flag.
  *Done when:* filing a discovery debrief on a sim deal yields sensible stakeholder /
  pain / process_fact nodes with provenance pointing at that event; filing a
  contradicting update supersedes rather than duplicates.

- [ ] **2.3 Interview transcript capture**
  `convex/guide.ts`, `src/components/GuidedChat.tsx` (and the filing path in
  `UpdateModal.tsx`)
  On finish, pass the full chat history through to the filed event's
  `interviewTranscript` so extraction sees everything said, not just collected fields.
  *Done when:* a guided-interview filing stores the transcript and extraction quotes
  from it.

## Phase 3 — Serving (retrieval into AI features)

- [ ] **3.1 `assembleKnowledge` helper**
  `convex/knowledge.ts`
  `assembleKnowledge({ workspace, vertical?, clientId?, charBudget? })` → labeled text
  block: tiers general → vertical → client, grouped by type, sorted confidence /
  recency, staleness annotations (60+ days), per-tier char caps (≈2k/3k/5k).
  *Done when:* returns a stable, readable block for a sim client; respects caps.

- [ ] **3.2 Wire into chat actions**
  `convex/chat.ts`, `src/components/ChatDock.tsx`
  Add optional `clientId` arg to `ask`; ChatDock passes it when opened from a client
  context (RecordCard / Clients). `ask`/`standup`/`weeklyReview` append the assembled
  block. System prompt: new section explaining the three tiers + rule to cite nodes
  with `[label](knowledge:NODE_ID)` when knowledge informs a claim.
  *Done when:* asking about a client from its record uses client knowledge and the
  answer carries `knowledge:` links; Board-level questions get general+vertical only.

- [ ] **3.3 Wire into the guided interview**
  `convex/guide.ts`
  Add `clientId`; include client + vertical + general knowledge in the system prompt,
  and extend the "ALREADY ON FILE" material with client-scope nodes so the interview
  confirms instead of re-asking known facts.
  *Done when:* interviewing on a deal whose EB is already a knowledge node makes the
  coach reference it ("we have the CFO as EB — still accurate?") instead of asking cold.

## Phase 4 — Promotion (vertical + general, gated)

- [ ] **4.1 Promotion scan**
  `convex/knowledgePromote.ts` (new), `convex/crons.ts` (new)
  Weekly cron + manual trigger mutation, per vertical: load all live client graphs +
  existing vertical nodes; Gemini proposes anonymized vertical nodes (`lesson` / `play`
  / `process_fact`) with `generalized_from` edges and `status: "proposed"`. Second pass
  proposes general-tier meta-lessons that `refine` seeded standards. Hard rule in
  prompt: no client names, "N of M clients" phrasing.
  *Done when:* with ≥2 clients sharing a pattern in sim, the scan produces a sensible
  anonymized proposal linked to its sources; re-running doesn't re-propose rejected
  or already-active equivalents.

- [ ] **4.2 Review actions**
  `convex/knowledge.ts`
  `approve` (status→active, confidence→1.0, optional edited claim), `reject`
  (status→rejected, kept for dedup). Only `active` nodes are served by
  `assembleKnowledge` (already enforced — verify).
  *Done when:* approving a proposal makes it appear in other clients' AI context;
  rejecting hides it everywhere and prevents re-proposal.

## Phase 5 — Showcase (UI)

- [ ] **5.1 Knowledge page: graph view**
  `src/components/Knowledge.tsx` (new), `src/App.tsx`, `src/styles.css`
  New top-nav item. Custom SVG force layout (no heavy deps): node color by type, size
  by degree, community grouping (simple label propagation client-side). Tier lens:
  General / Vertical / per-Client, defaulting to where the user came from. Workspace
  aware.
  *Done when:* sim workspace shows three navigable graphs; layout is readable at
  ~200 nodes.

- [ ] **5.2 Node inspector + provenance click-through**
  `src/components/Knowledge.tsx`, `src/components/RecordCard.tsx`
  Click node → panel: claim, detail, type, confidence, freshness, status, supersede
  chain, provenance links that open the source event in the deal timeline.
  *Done when:* every extracted node can be traced to its event in two clicks.

- [ ] **5.3 Review queue UI**
  `src/components/Knowledge.tsx`
  Tab listing proposed nodes with their `generalized_from` sources rendered;
  approve / edit-then-approve / reject inline.
  *Done when:* the Phase 4 flow is operable entirely from the UI.

- [ ] **5.4 In-context panels**
  `src/components/RecordCard.tsx`, `src/components/ChatDock.tsx`,
  `src/components/Markdown.tsx`
  RecordCard "Knowledge" tab (client slice list + mini-graph + applicable vertical
  lessons). Markdown link resolver learns `knowledge:NODE_ID` → opens node inspector.
  ChatDock footer: "what informed this answer" chips from the citations.
  *Done when:* an analyst answer's citations are clickable and land on the right nodes.

- [ ] **5.5 Sim demo seed + reset**
  `convex/scenarioData.ts` or `convex/knowledgeSeed.ts`, `convex/deals.ts`
  Curated sim-workspace knowledge: client nodes for the 13 seeded deals + a handful of
  waste-vertical lessons + 1–2 pending proposals (so the review queue demos too).
  `resetScenario` wipes sim knowledge and re-seeds it.
  *Done when:* "Load the simulated scenario" produces a full, populated three-tier
  demo; reset restores it exactly.

- [ ] **5.6 Client management touchpoint**
  `src/components/NewDealModal.tsx`, `src/components/Clients.tsx`
  New deal: pick existing client or create one (name + vertical). Clients page shows
  vertical badge.
  *Done when:* creating a live deal for a new company creates its client + empty graph.

## Phase 6 — Later / optional (not scheduled)

- [ ] Markdown export with backlinks (Obsidian-compatible) per scope.
- [ ] "Save this as a lesson" button on chat answers (explicit, not mined).
- [ ] Embedding-based retrieval when a tier outgrows its serialization budget.
- [ ] `extract.ts` enrichment with client stakeholder/metric nodes.
- [ ] Confidence analytics: which lessons actually correlate with won deals.

---

**Suggested checkpoints:** after Phase 2 (file an update in sim → watch nodes appear
in the Convex dashboard), after Phase 3 (the analyst visibly uses knowledge and cites
it), after Phase 5 (the full board-to-client lens demo).

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  deals: defineTable({
    // "sim" (seeded scenario) or "live" (real data). Missing = sim (pre-split docs).
    workspace: v.optional(v.string()),
    slug: v.string(),
    account: v.string(),
    site: v.string(),
    region: v.string(),
    throughput: v.string(),
    capability: v.string(),
    hook: v.string(),
    acv: v.number(),
    pocFee: v.optional(v.number()),
    owner: v.string(),
    // Link to the client (account) this deal belongs to. Optional for
    // pre-migration docs; backfilled by migrations.backfillClients.
    clientId: v.optional(v.id("clients")),
  }).index("by_slug", ["slug"]),

  // Single-document dynamic pipeline setup (stages, gates, templates).
  blueprint: defineTable({
    data: v.any(),
    updatedAt: v.string(),
  }),

  events: defineTable({
    dealId: v.id("deals"),
    at: v.string(), // ISO date, sim time
    author: v.string(),
    discipline: v.string(),
    type: v.string(), // template | stage | gate | note | flag
    templateId: v.optional(v.string()),
    payload: v.optional(v.any()),
    note: v.optional(v.string()),
    gatesSatisfied: v.optional(v.array(v.string())),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    override: v.optional(v.boolean()),
    attachments: v.optional(
      v.array(v.object({ storageId: v.string(), name: v.string(), mime: v.string() }))
    ),
    // Per-field provenance: "manual" | "ai" | "ai-edited" | {kind, quote}
    provenance: v.optional(v.any()),
    // Verbatim pasted notes — root evidence behind extracted values.
    evidenceText: v.optional(v.string()),
    // Full guided-interview transcript, saved on finish so knowledge
    // extraction sees everything said, not just the collected field values.
    interviewTranscript: v.optional(v.string()),
  }).index("by_deal", ["dealId"]),

  // ── Knowledge System ──────────────────────────────────────────────────────
  // Industry verticals. Seeded with "waste". Managed on the Process page.
  verticals: defineTable({
    vid: v.string(), // stable key, e.g. "waste"
    name: v.string(),
    description: v.string(),
  }).index("by_vid", ["vid"]),

  // A client = an account. The anchor for the client-tier knowledge graph.
  clients: defineTable({
    name: v.string(), // matches deals.account
    vertical: v.string(), // vid of a vertical
    workspace: v.string(), // "sim" | "live"
    createdAt: v.string(),
  })
    .index("by_workspace", ["workspace"])
    .index("by_workspace_name", ["workspace", "name"]),

  // One typed knowledge graph, three tiers selected by scopeLevel.
  // general  → workspace "shared", methodology/doctrine (seeded + meta-lessons)
  // vertical → workspace-scoped, cross-client lessons for one vertical
  // client   → workspace-scoped, tied to one clientId
  knowledge: defineTable({
    workspace: v.string(), // "shared" (general) | "sim" | "live"
    scopeLevel: v.string(), // "general" | "vertical" | "client"
    vertical: v.optional(v.string()), // set on vertical + client nodes
    clientId: v.optional(v.id("clients")), // set on client nodes
    type: v.string(), // stakeholder|pain|metric|objection|process_fact|lesson|play|standard
    title: v.string(),
    claim: v.string(),
    detail: v.optional(v.string()),
    confidence: v.number(), // 0..1
    status: v.string(), // active | proposed | superseded | rejected
    source: v.string(), // seeded | extracted | promoted | manual
    provenance: v.optional(
      v.array(
        v.object({
          eventId: v.optional(v.id("events")),
          dealId: v.optional(v.id("deals")),
          clientId: v.optional(v.id("clients")),
          quote: v.optional(v.string()),
          label: v.optional(v.string()),
        })
      )
    ),
    tags: v.optional(v.array(v.string())),
    community: v.optional(v.string()),
    createdAt: v.string(),
    lastConfirmedAt: v.string(),
  })
    .index("by_workspace", ["workspace"])
    .index("by_workspace_status", ["workspace", "status"])
    .index("by_scope_status", ["scopeLevel", "status"])
    .index("by_client", ["clientId"]),

  knowledgeEdges: defineTable({
    source: v.id("knowledge"),
    target: v.id("knowledge"),
    type: v.string(), // relates_to|about|blocks|validates|supersedes|generalized_from|refines
    note: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_source", ["source"])
    .index("by_target", ["target"]),

  // Observability for the background learning loop (extraction + promotion).
  extractionRuns: defineTable({
    kind: v.string(), // "extract" | "promote"
    eventId: v.optional(v.id("events")),
    workspace: v.optional(v.string()),
    status: v.string(), // ok | error | skipped
    opsApplied: v.optional(v.number()),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
    at: v.string(),
  }).index("by_at", ["at"]),
});

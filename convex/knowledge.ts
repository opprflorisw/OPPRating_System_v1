// ============================================================================
// Knowledge System — store access, retrieval (assemble) and review actions.
// One typed graph, three tiers (general / vertical / client). Client-tier
// writes are automatic (extraction); vertical/general writes are proposals a
// human approves here. See docs/knowledge-system-design.md.
// ============================================================================

import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { NODE_TYPES, isStale } from "./knowledgeModel";

type KNode = Doc<"knowledge">;

const nowISO = () => new Date().toISOString();

// Per-tier serialization budgets (characters). Keeps prompts bounded.
const BUDGET = { general: 2000, vertical: 3000, client: 5000 };

// ── Serialization for AI prompts ────────────────────────────────────────────

function serializeTier(label: string, nodes: KNode[], asOf: string, budget: number): string {
  const active = nodes.filter((n) => n.status === "active");
  if (active.length === 0) return "";
  const out: string[] = [`## ${label}`];
  let used = 0;
  let truncated = 0;
  for (const def of NODE_TYPES) {
    const group = active
      .filter((n) => n.type === def.type)
      .sort((a, b) => b.confidence - a.confidence || (a.lastConfirmedAt < b.lastConfirmedAt ? 1 : -1));
    if (group.length === 0) continue;
    const header = `### ${def.label}`;
    let wroteHeader = false;
    for (const n of group) {
      const stale = isStale(n.lastConfirmedAt, asOf) ? " ⚠(unconfirmed 60d+)" : "";
      const low = n.confidence < 0.6 ? " _(low confidence)_" : "";
      const line = `- ${n.claim}${stale}${low} [id ${n._id}]`;
      const cost = line.length + (wroteHeader ? 0 : header.length + 1);
      if (used + cost > budget) {
        truncated++;
        continue;
      }
      if (!wroteHeader) {
        out.push(header);
        wroteHeader = true;
      }
      out.push(line);
      used += cost;
    }
  }
  if (truncated > 0) out.push(`- …(${truncated} more, trimmed for length)`);
  return out.length > 1 ? out.join("\n") : "";
}

async function activeByScope(
  ctx: { db: any },
  scopeLevel: string
): Promise<KNode[]> {
  return await ctx.db
    .query("knowledge")
    .withIndex("by_scope_status", (q: any) => q.eq("scopeLevel", scopeLevel).eq("status", "active"))
    .collect();
}

// The retrieval helper every AI feature calls. Returns a labeled markdown block:
// general (always) + vertical (this workspace) + client (when clientId given).
export const assemble = query({
  args: {
    workspace: v.string(),
    vertical: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    asOf: v.optional(v.string()),
  },
  handler: async (ctx, { workspace, vertical, clientId, asOf }): Promise<string> => {
    const today = asOf ?? nowISO().slice(0, 10);

    // Resolve the vertical from the client if not given.
    let vert = vertical;
    if (clientId && !vert) {
      const c = await ctx.db.get(clientId);
      if (c) vert = (c as Doc<"clients">).vertical;
    }

    const general = await activeByScope(ctx, "general");
    const verticalNodes = (await activeByScope(ctx, "vertical")).filter(
      (n) => n.workspace === workspace && (!vert || n.vertical === vert)
    );
    let clientNodes: KNode[] = [];
    if (clientId) {
      clientNodes = (
        await ctx.db.query("knowledge").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect()
      ).filter((n) => n.status === "active");
    }

    const blocks = [
      serializeTier("General methodology", general, today, BUDGET.general),
      serializeTier(vert ? `Vertical: ${vert}` : "Vertical lessons", verticalNodes, today, BUDGET.vertical),
      clientId ? serializeTier("This client", clientNodes, today, BUDGET.client) : "",
    ].filter(Boolean);

    if (blocks.length === 0) return "";
    return (
      "KNOWLEDGE GRAPH — interpretation layer (facts the team has learned; the deal-state JSON above remains the factual backbone).\n" +
      "When a claim here informs your answer, cite it as [short label](knowledge:NODE_ID) using the bracketed id.\n\n" +
      blocks.join("\n\n")
    );
  },
});

// ── UI: the full graph for a workspace (general + this-workspace tiers) ──────

export const graph = query({
  args: { workspace: v.string() },
  handler: async (ctx, { workspace }) => {
    const general = await ctx.db
      .query("knowledge")
      .withIndex("by_workspace", (q) => q.eq("workspace", "shared"))
      .collect();
    const ws = await ctx.db
      .query("knowledge")
      .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
      .collect();
    const nodes = [...general, ...ws].filter((n) => n.status !== "rejected");
    const idset = new Set(nodes.map((n) => n._id));

    // Edges where both endpoints are in the returned set.
    const allEdges = await ctx.db.query("knowledgeEdges").collect();
    const edges = allEdges.filter((e) => idset.has(e.source) && idset.has(e.target));

    const clients = (
      await ctx.db.query("clients").withIndex("by_workspace", (q) => q.eq("workspace", workspace)).collect()
    ).sort((a, b) => a.name.localeCompare(b.name));
    const verticals = await ctx.db.query("verticals").collect();

    return { nodes, edges, clients, verticals };
  },
});

// A single client's slice (for the RecordCard Knowledge tab).
export const forClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    const client = await ctx.db.get(clientId);
    const nodes = (
      await ctx.db.query("knowledge").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect()
    ).filter((n) => n.status !== "rejected");
    const idset = new Set(nodes.map((n) => n._id));
    const allEdges = await ctx.db.query("knowledgeEdges").collect();
    const edges = allEdges.filter((e) => idset.has(e.source) || idset.has(e.target));
    // Applicable vertical lessons for context.
    let lessons: KNode[] = [];
    if (client) {
      lessons = (await activeByScope(ctx, "vertical")).filter(
        (n) => n.workspace === (client as Doc<"clients">).workspace &&
          n.vertical === (client as Doc<"clients">).vertical
      );
    }
    return { client, nodes, edges, lessons };
  },
});

// Find the client doc that owns a deal (by deal slug) — used to open the
// client knowledge in the right context from a record.
export const clientForDeal = query({
  args: { slug: v.string(), workspace: v.string() },
  handler: async (ctx, { slug, workspace }) => {
    const deal = (await ctx.db.query("deals").withIndex("by_slug", (q) => q.eq("slug", slug)).first());
    if (!deal) return null;
    if (deal.clientId) return await ctx.db.get(deal.clientId);
    // Fall back to name match within the workspace.
    return (
      await ctx.db
        .query("clients")
        .withIndex("by_workspace_name", (q) => q.eq("workspace", workspace).eq("name", deal.account))
        .first()
    );
  },
});

// The review queue: proposed vertical/general nodes with their source nodes.
export const proposed = query({
  args: { workspace: v.string() },
  handler: async (ctx, { workspace }) => {
    const props = (
      await ctx.db
        .query("knowledge")
        .withIndex("by_workspace_status", (q) => q.eq("workspace", workspace).eq("status", "proposed"))
        .collect()
    );
    // General-tier proposals live under workspace "shared".
    const shared = (
      await ctx.db
        .query("knowledge")
        .withIndex("by_workspace_status", (q) => q.eq("workspace", "shared").eq("status", "proposed"))
        .collect()
    );
    const all = [...props, ...shared];
    const out = [];
    for (const node of all) {
      const srcEdges = await ctx.db
        .query("knowledgeEdges")
        .withIndex("by_source", (q) => q.eq("source", node._id))
        .collect();
      const sources = [];
      for (const e of srcEdges.filter((x) => x.type === "generalized_from" || x.type === "refines")) {
        const t = await ctx.db.get(e.target);
        if (t) sources.push({ type: e.type, node: t });
      }
      out.push({ node, sources });
    }
    return out;
  },
});

export const counts = query({
  args: { workspace: v.string() },
  handler: async (ctx, { workspace }) => {
    const general = (await activeByScope(ctx, "general")).length;
    const vertical = (await activeByScope(ctx, "vertical")).filter((n) => n.workspace === workspace).length;
    const client = (
      await ctx.db.query("knowledge").withIndex("by_workspace_status", (q) => q.eq("workspace", workspace).eq("status", "active")).collect()
    ).filter((n) => n.scopeLevel === "client").length;
    const pending = (
      await ctx.db.query("knowledge").withIndex("by_workspace_status", (q) => q.eq("workspace", workspace).eq("status", "proposed")).collect()
    ).length + (
      await ctx.db.query("knowledge").withIndex("by_workspace_status", (q) => q.eq("workspace", "shared").eq("status", "proposed")).collect()
    ).length;
    return { general, vertical, client, pending };
  },
});

export const recentRuns = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("extractionRuns").withIndex("by_at").order("desc").take(20);
  },
});

// ── Review actions (gate for vertical/general promotions) ───────────────────

export const approve = mutation({
  args: { nodeId: v.id("knowledge"), title: v.optional(v.string()), claim: v.optional(v.string()) },
  handler: async (ctx, { nodeId, title, claim }) => {
    const node = await ctx.db.get(nodeId);
    if (!node) return;
    await ctx.db.patch(nodeId, {
      status: "active",
      confidence: 1.0,
      lastConfirmedAt: nowISO(),
      ...(title ? { title } : {}),
      ...(claim ? { claim } : {}),
    });
  },
});

export const reject = mutation({
  args: { nodeId: v.id("knowledge") },
  handler: async (ctx, { nodeId }) => {
    const node = await ctx.db.get(nodeId);
    if (!node) return;
    await ctx.db.patch(nodeId, { status: "rejected" });
  },
});

// Manual node add/edit from the UI (a human curating the graph directly).
export const addManual = mutation({
  args: {
    workspace: v.string(),
    scopeLevel: v.string(),
    vertical: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    type: v.string(),
    title: v.string(),
    claim: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const at = nowISO();
    return await ctx.db.insert("knowledge", {
      workspace: args.workspace,
      scopeLevel: args.scopeLevel,
      vertical: args.vertical,
      clientId: args.clientId,
      type: args.type,
      title: args.title,
      claim: args.claim,
      detail: args.detail,
      confidence: 1.0,
      status: "active",
      source: "manual",
      createdAt: at,
      lastConfirmedAt: at,
    });
  },
});

// ── Internal: apply a batch of extraction/promotion ops ─────────────────────

const opValidator = v.object({
  op: v.string(), // add | update | confirm | supersede
  id: v.optional(v.id("knowledge")),
  type: v.optional(v.string()),
  title: v.optional(v.string()),
  claim: v.optional(v.string()),
  detail: v.optional(v.string()),
  confidence: v.optional(v.number()),
  tags: v.optional(v.array(v.string())),
  quote: v.optional(v.string()),
  // promotion: link a new proposal to its source nodes
  sourceIds: v.optional(v.array(v.id("knowledge"))),
  edgeType: v.optional(v.string()), // generalized_from | refines | relates_to
});

export const applyOps = internalMutation({
  args: {
    ops: v.array(opValidator),
    context: v.object({
      workspace: v.string(),
      scopeLevel: v.string(),
      vertical: v.optional(v.string()),
      clientId: v.optional(v.id("clients")),
      source: v.string(),
      status: v.string(), // active | proposed
      at: v.optional(v.string()),
      eventId: v.optional(v.id("events")),
      dealId: v.optional(v.id("deals")),
    }),
  },
  handler: async (ctx, { ops, context }): Promise<number> => {
    const at = context.at ?? nowISO();
    const prov = (quote?: string) =>
      [{ eventId: context.eventId, dealId: context.dealId, clientId: context.clientId, quote }];
    let applied = 0;

    const insertNode = async (o: any): Promise<Id<"knowledge">> => {
      return await ctx.db.insert("knowledge", {
        workspace: context.workspace,
        scopeLevel: context.scopeLevel,
        vertical: context.vertical,
        clientId: context.clientId,
        type: o.type ?? "lesson",
        title: o.title ?? (o.claim ? String(o.claim).slice(0, 60) : "Untitled"),
        claim: o.claim ?? o.title ?? "",
        detail: o.detail,
        confidence: typeof o.confidence === "number" ? Math.max(0, Math.min(1, o.confidence)) : 0.6,
        status: context.status,
        source: context.source,
        provenance: prov(o.quote),
        tags: o.tags,
        createdAt: at,
        lastConfirmedAt: at,
      });
    };
    const link = async (source: Id<"knowledge">, target: Id<"knowledge">, type: string) => {
      await ctx.db.insert("knowledgeEdges", { source, target, type, createdAt: at });
    };

    for (const o of ops) {
      try {
        if (o.op === "add") {
          if (!o.claim && !o.title) continue;
          const newId = await insertNode(o);
          for (const sid of o.sourceIds ?? []) {
            if (await ctx.db.get(sid)) await link(newId, sid, o.edgeType ?? "generalized_from");
          }
          applied++;
        } else if (o.op === "confirm" && o.id) {
          const ex = await ctx.db.get(o.id);
          if (!ex) continue;
          await ctx.db.patch(o.id, {
            lastConfirmedAt: at,
            confidence: Math.min(1, Math.max(ex.confidence, o.confidence ?? ex.confidence)),
            provenance: [...(ex.provenance ?? []), ...prov(o.quote)],
          });
          applied++;
        } else if (o.op === "update" && o.id) {
          const ex = await ctx.db.get(o.id);
          if (!ex) continue;
          await ctx.db.patch(o.id, {
            ...(o.claim ? { claim: o.claim } : {}),
            ...(o.title ? { title: o.title } : {}),
            ...(o.detail !== undefined ? { detail: o.detail } : {}),
            ...(typeof o.confidence === "number" ? { confidence: Math.max(0, Math.min(1, o.confidence)) } : {}),
            lastConfirmedAt: at,
            provenance: [...(ex.provenance ?? []), ...prov(o.quote)],
          });
          applied++;
        } else if (o.op === "supersede" && o.id) {
          const old = await ctx.db.get(o.id);
          if (!old) continue;
          const newId = await insertNode(o);
          await ctx.db.patch(o.id, { status: "superseded" });
          await link(newId, o.id, "supersedes");
          applied++;
        }
      } catch {
        // One bad op never sinks the batch.
      }
    }
    return applied;
  },
});

export const logRun = internalMutation({
  args: {
    kind: v.string(),
    eventId: v.optional(v.id("events")),
    workspace: v.optional(v.string()),
    status: v.string(),
    opsApplied: v.optional(v.number()),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("extractionRuns", { ...args, at: nowISO() });
  },
});

// Internal: the material the promotion scan reasons over for one vertical.
export const promotionContext = internalQuery({
  args: { workspace: v.string(), vertical: v.string() },
  handler: async (ctx, { workspace, vertical }) => {
    const wsNodes = await ctx.db
      .query("knowledge")
      .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
      .collect();
    const clientNodes = wsNodes.filter(
      (n) => n.scopeLevel === "client" && n.status === "active" && n.vertical === vertical
    );
    // Existing vertical nodes in any status (avoid re-proposing the known).
    const existingVertical = wsNodes.filter((n) => n.scopeLevel === "vertical" && n.vertical === vertical);
    const generalStandards = (await activeByScope(ctx, "general")).filter((n) => n.type === "standard");
    // Map clientId -> name so the prompt can group without leaking names.
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
      .collect();
    return { clientNodes, existingVertical, generalStandards, clientCount: clients.length };
  },
});

// Internal: everything the extractor needs about one event, in one round-trip.
export const extractionContext = internalQuery({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (!event) return null;
    const deal = await ctx.db.get(event.dealId);
    if (!deal) return null;
    let client: Doc<"clients"> | null = null;
    if (deal.clientId) client = await ctx.db.get(deal.clientId);
    if (!client) {
      client = await ctx.db
        .query("clients")
        .withIndex("by_workspace_name", (q) =>
          q.eq("workspace", deal.workspace ?? "sim").eq("name", deal.account)
        )
        .first();
    }
    const existing = client
      ? (
          await ctx.db.query("knowledge").withIndex("by_client", (q) => q.eq("clientId", client!._id)).collect()
        ).filter((n) => n.status === "active")
      : [];
    return { event, deal, client, existing };
  },
});

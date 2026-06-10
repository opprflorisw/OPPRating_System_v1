import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { SEED_DEALS } from "./scenarioData";
import { ensureClientsInner } from "./migrations";
import { seedGeneralInner, seedSimInner } from "./knowledgeSeed";

// All deals in a workspace, with their full event logs. The frontend replays
// them client-side so the time slider works without round-trips.
// Workspaces: "sim" = the seeded scenario, "live" = real data entered by hand.
export const list = query({
  args: { workspace: v.optional(v.string()) },
  handler: async (ctx, { workspace }) => {
    const ws = workspace ?? "sim";
    const deals = (await ctx.db.query("deals").collect()).filter(
      (d) => (d.workspace ?? "sim") === ws
    );
    const result = [];
    for (const deal of deals) {
      const events = await ctx.db
        .query("events")
        .withIndex("by_deal", (q) => q.eq("dealId", deal._id))
        .collect();
      events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a._creationTime - b._creationTime));
      // Resolve attachment URLs so root evidence (voice memos, files) is
      // playable/openable straight from the record.
      const withUrls = [];
      for (const e of events) {
        if (e.attachments && e.attachments.length > 0) {
          const attachments = [];
          for (const a of e.attachments) {
            let url: string | null = null;
            try { url = await ctx.storage.getUrl(a.storageId as never); } catch { /* dangling id */ }
            attachments.push({ ...a, url });
          }
          withUrls.push({ ...e, attachments });
        } else {
          withUrls.push(e);
        }
      }
      result.push({ ...deal, events: withUrls });
    }
    return result;
  },
});

// Start a new deal — the record card is born here and only ever grows.
export const createDeal = mutation({
  args: {
    workspace: v.string(),
    account: v.string(),
    site: v.string(),
    region: v.string(),
    throughput: v.string(),
    capability: v.string(),
    hook: v.string(),
    acv: v.number(),
    pocFee: v.optional(v.number()),
    owner: v.string(),
    at: v.string(),
    author: v.string(),
  },
  handler: async (ctx, args) => {
    const slugBase = `${args.account}-${args.site}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60);
    // Keep slugs unique within the workspace.
    const existing = (await ctx.db.query("deals").collect()).filter(
      (d) => (d.workspace ?? "sim") === args.workspace && d.slug.startsWith(slugBase)
    );
    const slug = existing.length === 0 ? slugBase : `${slugBase}-${existing.length + 1}`;

    // Find or create the client (account) so the knowledge graph has an anchor
    // from the very first filing.
    let client = await ctx.db
      .query("clients")
      .withIndex("by_workspace_name", (q) => q.eq("workspace", args.workspace).eq("name", args.account))
      .first();
    if (!client) {
      const clientId = await ctx.db.insert("clients", {
        name: args.account,
        vertical: "waste",
        workspace: args.workspace,
        createdAt: new Date().toISOString(),
      });
      client = await ctx.db.get(clientId);
    }

    const dealId = await ctx.db.insert("deals", {
      workspace: args.workspace,
      clientId: client?._id,
      slug,
      account: args.account,
      site: args.site,
      region: args.region,
      throughput: args.throughput,
      capability: args.capability,
      hook: args.hook,
      acv: args.acv,
      pocFee: args.pocFee,
      owner: args.owner,
    });
    await ctx.db.insert("events", {
      dealId,
      at: args.at,
      author: args.author,
      discipline: "Sales",
      type: "note",
      note: `Deal created. Entry stage: Lead. ${args.hook}`,
    });
    return { dealId, slug };
  },
});

// Append one event to a deal's record. Stage moves, template filings, gate
// checks and notes all flow through here — the record card only ever grows.
export const appendEvent = mutation({
  args: {
    dealId: v.id("deals"),
    at: v.string(),
    author: v.string(),
    discipline: v.string(),
    type: v.string(),
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
    provenance: v.optional(v.any()),
    evidenceText: v.optional(v.string()),
    interviewTranscript: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const eventId = await ctx.db.insert("events", args);
    // Feed the background learning loop: substantive filings schedule a
    // knowledge extraction. Stage/gate/flag events with no content are skipped.
    const noteLen = args.note?.trim().length ?? 0;
    const substantive =
      args.type === "template" || Boolean(args.evidenceText) || (args.type === "note" && noteLen > 40);
    if (substantive) {
      await ctx.scheduler.runAfter(0, internal.knowledgeExtract.extractFromEvent, { eventId });
    }
    return eventId;
  },
});

// Wipe and re-seed the simulated scenario. Never touches the live workspace.
export const resetScenario = mutation({
  args: {},
  handler: async (ctx) => {
    const simDeals = (await ctx.db.query("deals").collect()).filter(
      (d) => (d.workspace ?? "sim") === "sim"
    );
    for (const d of simDeals) {
      const events = await ctx.db
        .query("events")
        .withIndex("by_deal", (q) => q.eq("dealId", d._id))
        .collect();
      for (const e of events) await ctx.db.delete(e._id);
      await ctx.db.delete(d._id);
    }
    // Wipe sim-workspace knowledge too, so a reset restores a clean graph.
    const simKnow = (await ctx.db.query("knowledge").withIndex("by_workspace", (q) => q.eq("workspace", "sim")).collect());
    const simKnowIds = new Set(simKnow.map((n) => n._id));
    for (const e of await ctx.db.query("knowledgeEdges").collect()) {
      if (simKnowIds.has(e.source) || simKnowIds.has(e.target)) await ctx.db.delete(e._id);
    }
    for (const n of simKnow) await ctx.db.delete(n._id);
    // Drop sim clients (re-created by ensureClientsInner below).
    for (const c of await ctx.db.query("clients").withIndex("by_workspace", (q) => q.eq("workspace", "sim")).collect()) {
      await ctx.db.delete(c._id);
    }

    for (const seed of SEED_DEALS) {
      const { events, ...deal } = seed;
      const dealId = await ctx.db.insert("deals", { ...deal, workspace: "sim" });
      for (const ev of events) {
        await ctx.db.insert("events", { dealId, ...ev });
      }
    }

    // Rebuild the knowledge foundation for the fresh sim scenario.
    await ensureClientsInner(ctx, "waste");
    await seedGeneralInner(ctx); // shared/general (idempotent)
    await seedSimInner(ctx); // sim client + vertical demo graph
    return { deals: SEED_DEALS.length };
  },
});

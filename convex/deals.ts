import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { SEED_DEALS } from "./scenarioData";

// All deals with their full event logs. The frontend replays them client-side
// so the time slider works without round-trips.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const deals = await ctx.db.query("deals").collect();
    const result = [];
    for (const deal of deals) {
      const events = await ctx.db
        .query("events")
        .withIndex("by_deal", (q) => q.eq("dealId", deal._id))
        .collect();
      events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a._creationTime - b._creationTime));
      result.push({ ...deal, events });
    }
    return result;
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
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events", args);
  },
});

// Wipe and re-seed the simulated scenario.
export const resetScenario = mutation({
  args: {},
  handler: async (ctx) => {
    for (const e of await ctx.db.query("events").collect()) await ctx.db.delete(e._id);
    for (const d of await ctx.db.query("deals").collect()) await ctx.db.delete(d._id);
    for (const seed of SEED_DEALS) {
      const { events, ...deal } = seed;
      const dealId = await ctx.db.insert("deals", deal);
      for (const ev of events) {
        await ctx.db.insert("events", { dealId, ...ev });
      }
    }
    return { deals: SEED_DEALS.length };
  },
});

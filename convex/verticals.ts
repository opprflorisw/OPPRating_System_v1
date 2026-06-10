// ============================================================================
// Industry verticals. Seeded with "waste" (waste collectors & WtE operators).
// The vertical is the middle knowledge tier — lessons that travel between
// clients in the same industry.
// ============================================================================

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const DEFAULT_VERTICALS = [
  {
    vid: "waste",
    name: "Waste & Energy-from-Waste",
    description:
      "Waste collectors, sorters and Energy-from-Waste operators. Variable feedstock, operator judgment, expensive assets, EPR/CO2-levy economics.",
  },
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    return (await ctx.db.query("verticals").collect()).sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Idempotent: make sure the default verticals exist. Safe to call repeatedly.
export const ensureSeed = mutation({
  args: {},
  handler: async (ctx) => {
    let created = 0;
    for (const vrt of DEFAULT_VERTICALS) {
      const existing = await ctx.db.query("verticals").withIndex("by_vid", (q) => q.eq("vid", vrt.vid)).first();
      if (!existing) {
        await ctx.db.insert("verticals", vrt);
        created++;
      }
    }
    return { created };
  },
});

export const add = mutation({
  args: { vid: v.string(), name: v.string(), description: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("verticals").withIndex("by_vid", (q) => q.eq("vid", args.vid)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { name: args.name, description: args.description });
      return existing._id;
    }
    return await ctx.db.insert("verticals", args);
  },
});

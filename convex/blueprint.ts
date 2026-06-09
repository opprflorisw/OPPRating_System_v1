// ============================================================================
// The blueprint — the dynamic pipeline setup (stages, gates, templates),
// stored as one document. When present it overrides the built-in defaults;
// deleting it falls back to them. Edited from the Process page.
// ============================================================================

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("blueprint").first();
  },
});

export const save = mutation({
  args: { data: v.any() },
  handler: async (ctx, { data }) => {
    const existing = await ctx.db.query("blueprint").first();
    const doc = { data, updatedAt: new Date().toISOString() };
    if (existing) await ctx.db.patch(existing._id, doc);
    else await ctx.db.insert("blueprint", doc);
  },
});

export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("blueprint").first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

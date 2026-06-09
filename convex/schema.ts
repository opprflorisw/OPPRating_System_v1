import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  deals: defineTable({
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
  }).index("by_slug", ["slug"]),

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
  }).index("by_deal", ["dealId"]),
});

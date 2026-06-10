// ============================================================================
// Migrations / one-time setup for the Knowledge System.
// - ensureClients: one client (account) per workspace, deals linked to it.
// All migrations are idempotent.
// ============================================================================

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const nowISO = () => new Date().toISOString();

// Plain helper so other mutations (e.g. deals.resetScenario) can reuse it.
export async function ensureClientsInner(
  ctx: MutationCtx,
  vert: string
): Promise<{ clientsCreated: number; dealsLinked: number }> {
  const deals = await ctx.db.query("deals").collect();
  let clientsCreated = 0;
  let dealsLinked = 0;
  const cache = new Map<string, Id<"clients">>();

  for (const deal of deals) {
    const ws = deal.workspace ?? "sim";
    const key = `${ws}|${deal.account}`;
    let clientId = cache.get(key);
    if (!clientId) {
      const existing = await ctx.db
        .query("clients")
        .withIndex("by_workspace_name", (q) => q.eq("workspace", ws).eq("name", deal.account))
        .first();
      if (existing) {
        clientId = existing._id;
      } else {
        clientId = await ctx.db.insert("clients", {
          name: deal.account,
          vertical: vert,
          workspace: ws,
          createdAt: nowISO(),
        });
        clientsCreated++;
      }
      cache.set(key, clientId);
    }
    if (deal.clientId !== clientId) {
      await ctx.db.patch(deal._id, { clientId });
      dealsLinked++;
    }
  }
  return { clientsCreated, dealsLinked };
}

// Create a client per distinct account per workspace and stamp deal.clientId.
export const ensureClients = mutation({
  args: { vertical: v.optional(v.string()) },
  handler: async (ctx, { vertical }) => {
    return await ensureClientsInner(ctx, vertical ?? "waste");
  },
});

// ============================================================================
// The promotion engine — vertical & general tiers (gated).
// Reads all client graphs in a vertical and proposes ANONYMIZED cross-client
// lessons (status "proposed"), each wired to its source client nodes via
// generalized_from edges. A human approves in the review queue before any AI
// feature uses them. Runs weekly (cron) and on demand.
// ============================================================================

import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { NODE_TYPE_SET } from "./knowledgeModel";
import { geminiGenerate, parseJsonLoose } from "./gemini";

interface RawProp {
  type?: string;
  title?: string;
  claim?: string;
  confidence?: number;
  sourceIds?: string[];
  refinesId?: string;
}

async function runScan(ctx: any, workspace: string, vertical: string): Promise<{ vertical: number; general: number }> {
  const log = (status: string, extra: Record<string, unknown> = {}) =>
    ctx.runMutation(internal.knowledge.logRun, { kind: "promote", workspace, status, ...extra });

  const c = await ctx.runQuery(internal.knowledge.promotionContext, { workspace, vertical });
  if (!c || c.clientNodes.length < 2) {
    await log("skipped", { summary: "not enough client knowledge yet" });
    return { vertical: 0, general: 0 };
  }

  const clientLines = c.clientNodes
    .map((n: any) => `- [id ${n._id}] (${n.type}) ${n.claim}`)
    .join("\n");
  const existingLines =
    c.existingVertical.map((n: any) => `- (${n.status}) ${n.claim}`).join("\n") || "(none yet)";
  const standardLines =
    c.generalStandards.map((n: any) => `- [id ${n._id}] ${n.claim}`).join("\n") || "(none)";

  const system =
    `You are the RevOps knowledge lead at Oppr B.V. (industrial AI for waste & manufacturing). ` +
    `You look across the CLIENT-level knowledge of every account in the "${vertical}" vertical and propose ` +
    `cross-client LESSONS and PLAYS worth teaching the whole team.\n\n` +
    `HARD RULES:\n` +
    `- ANONYMIZE. Never name a specific client. Phrase as "N of ${c.clientCount} operators…" or "operators with municipal owners…".\n` +
    `- Only propose a pattern seen across 2+ clients, or a single very strong, generalizable insight.\n` +
    `- Each proposal cites the client node ids it generalizes from (sourceIds) — use the bracketed ids exactly.\n` +
    `- claim = one crisp, teachable sentence. type = lesson or play (or process_fact).\n` +
    `- Do NOT repeat anything already in the existing vertical knowledge.\n` +
    `- Optionally, propose 0-2 GENERAL methodology refinements: a lesson that sharpens a listed standard (cite refinesId).\n` +
    `- confidence 0..1. Propose only what's well-supported. 0 proposals is a valid answer.\n` +
    `Respond ONLY with JSON: {"vertical":[{type,title,claim,confidence,sourceIds:[]}], "general":[{type,title,claim,confidence,refinesId}]}.`;

  const user =
    `CLIENT KNOWLEDGE (${vertical}):\n${clientLines}\n\n` +
    `EXISTING VERTICAL KNOWLEDGE (do not duplicate):\n${existingLines}\n\n` +
    `GENERAL STANDARDS (for optional refinements):\n${standardLines}`;

  const result = await geminiGenerate({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 2048, responseMimeType: "application/json" },
  });
  if (!result.ok) {
    await log("error", { error: result.error.slice(0, 200) });
    return { vertical: 0, general: 0 };
  }
  const parsed = parseJsonLoose<{ vertical?: RawProp[]; general?: RawProp[] }>(result.text);

  const validClientIds = new Set(c.clientNodes.map((n: any) => String(n._id)));
  const validStandardIds = new Set(c.generalStandards.map((n: any) => String(n._id)));

  // Vertical proposals.
  const vOps = (parsed?.vertical ?? [])
    .filter((p) => p.claim)
    .map((p) => ({
      op: "add" as const,
      type: p.type && NODE_TYPE_SET.has(p.type) ? p.type : "lesson",
      title: p.title?.slice(0, 80),
      claim: p.claim!.slice(0, 400),
      confidence: typeof p.confidence === "number" ? Math.max(0, Math.min(1, p.confidence)) : 0.6,
      sourceIds: (p.sourceIds ?? []).filter((id) => validClientIds.has(String(id))) as any,
      edgeType: "generalized_from",
    }));

  let verticalCount = 0;
  if (vOps.length > 0) {
    verticalCount = await ctx.runMutation(internal.knowledge.applyOps, {
      ops: vOps,
      context: { workspace, scopeLevel: "vertical", vertical, source: "promoted", status: "proposed" },
    });
  }

  // General proposals (refining a standard).
  const gOps = (parsed?.general ?? [])
    .filter((p) => p.claim && p.refinesId && validStandardIds.has(String(p.refinesId)))
    .map((p) => ({
      op: "add" as const,
      type: p.type && NODE_TYPE_SET.has(p.type) ? p.type : "lesson",
      title: p.title?.slice(0, 80),
      claim: p.claim!.slice(0, 400),
      confidence: typeof p.confidence === "number" ? Math.max(0, Math.min(1, p.confidence)) : 0.6,
      sourceIds: [p.refinesId] as any,
      edgeType: "refines",
    }));

  let generalCount = 0;
  if (gOps.length > 0) {
    generalCount = await ctx.runMutation(internal.knowledge.applyOps, {
      ops: gOps,
      context: { workspace: "shared", scopeLevel: "general", source: "promoted", status: "proposed" },
    });
  }

  await log("ok", {
    opsApplied: verticalCount + generalCount,
    summary: `${verticalCount} vertical + ${generalCount} general proposal(s) for ${vertical}`,
  });
  return { vertical: verticalCount, general: generalCount };
}

// Manual trigger from the Knowledge page ("Scan for lessons now").
export const scan = action({
  args: { workspace: v.string(), vertical: v.optional(v.string()) },
  handler: async (ctx, { workspace, vertical }) => {
    return await runScan(ctx, workspace, vertical ?? "waste");
  },
});

// Weekly cron entry — scans the live workspace for every known vertical.
export const scheduledScan = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const verticals = (await ctx.runQuery(api.verticals.list, {})) as { vid: string }[];
    for (const vrt of verticals) {
      await runScan(ctx, "live", vrt.vid);
    }
  },
});

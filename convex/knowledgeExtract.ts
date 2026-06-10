// ============================================================================
// The learning loop — client-tier knowledge extraction.
// A substantive filing schedules this action. It diffs the new record against
// what we already know about the client and emits operations (add / confirm /
// update / supersede). Client-tier writes are automatic; every node cites the
// event it came from. Failures are logged, never block filing.
// ============================================================================

import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { TEMPLATE_BY_ID, applyBlueprint } from "./pipeline";
import { NODE_TYPES, NODE_TYPE_SET } from "./knowledgeModel";
import { geminiGenerate, parseJsonLoose } from "./gemini";

interface RawOp {
  op?: string;
  id?: string;
  type?: string;
  title?: string;
  claim?: string;
  detail?: string;
  confidence?: number;
  quote?: string;
}

const ontology = NODE_TYPES.map((n) => `- ${n.type}: ${n.what}`).join("\n");

// Render the new filing as readable text for the model.
function recordText(event: any): string {
  const bits: string[] = [];
  if (event.templateId) {
    const tpl = TEMPLATE_BY_ID[event.templateId];
    bits.push(`Filing: ${tpl?.name ?? event.templateId} (${event.discipline}, ${event.at})`);
    if (tpl && event.payload) {
      for (const f of tpl.fields) {
        const raw = (event.payload as Record<string, unknown>)[f.id];
        if (raw === undefined || raw === null || raw === "" || raw === false) continue;
        const label = (f.group ? f.group + " · " : "") + f.label;
        bits.push(`  ${label}: ${typeof raw === "boolean" ? "yes" : String(raw)}`);
      }
    }
  } else {
    bits.push(`Event: ${event.type} (${event.discipline}, ${event.at})`);
  }
  if (event.note) bits.push(`Note: ${event.note}`);
  if (event.evidenceText) bits.push(`Raw evidence:\n${event.evidenceText}`);
  if (event.interviewTranscript) bits.push(`Interview transcript:\n${event.interviewTranscript}`);
  return bits.join("\n");
}

export const extractFromEvent = internalAction({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }): Promise<void> => {
    const log = (status: string, extra: Record<string, unknown> = {}) =>
      ctx.runMutation(internal.knowledge.logRun, { kind: "extract", eventId, status, ...extra });

    const bundle = await ctx.runQuery(internal.knowledge.extractionContext, { eventId });
    if (!bundle || !bundle.client) {
      await log("skipped", { summary: "no client for event" });
      return;
    }
    const { event, deal, client, existing } = bundle;

    // Need the active blueprint to resolve template field labels.
    const bp = await ctx.runQuery(api.blueprint.get, {});
    applyBlueprint((bp?.data as never) ?? null);

    const record = recordText(event);
    if (record.trim().length < 30) {
      await log("skipped", { summary: "thin record" });
      return;
    }

    const known = existing
      .map((n) => `- [id ${n._id}] (${n.type}) ${n.claim}`)
      .join("\n") || "(nothing yet — this is a new client graph)";

    const system =
      `You maintain the CLIENT knowledge graph for Oppr B.V. (industrial AI for waste & manufacturing plants).\n` +
      `You read one new filing about the account "${deal.account}" and decide how the client's knowledge graph should change.\n\n` +
      `Node types (pick the best fit per fact):\n${ontology}\n\n` +
      `You will receive (a) the CURRENT knowledge nodes and (b) the NEW filing. Return operations:\n` +
      `- {"op":"add", "type", "title", "claim", "confidence", "quote"} for a genuinely new fact.\n` +
      `- {"op":"confirm", "id"} when the filing re-affirms an existing node unchanged.\n` +
      `- {"op":"update", "id", "claim", "confidence", "quote"} when it sharpens/extends an existing node.\n` +
      `- {"op":"supersede", "id", "type", "title", "claim", "confidence", "quote"} when it CONTRADICTS an existing node (id = the old node; the new node replaces it).\n\n` +
      `Rules:\n` +
      `- claim = ONE crisp sentence, specific to this client (names, numbers, dates). No generic industry talk.\n` +
      `- Only use facts actually present in the filing. Do not invent. quote = the short evidence fragment (<=20 words).\n` +
      `- confidence 0..1 (0.5 hearsay, 0.7 stated, 0.9 documented/confirmed).\n` +
      `- Prefer confirm/update/supersede over duplicating an existing node. Use the bracketed id exactly.\n` +
      `- 0 to ~6 ops. If the filing adds no durable knowledge, return an empty list.\n` +
      `Respond with ONLY JSON: {"ops":[ ... ]}.`;

    const user = `CURRENT KNOWLEDGE:\n${known}\n\nNEW FILING:\n${record}`;

    const result = await geminiGenerate({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: "application/json" },
    });
    if (!result.ok) {
      await log("error", { error: result.error.slice(0, 200) });
      return;
    }
    const parsed = parseJsonLoose<{ ops?: RawOp[] }>(result.text);
    const rawOps = parsed?.ops ?? [];

    // Sanitize before handing to the validator: valid ids only, known types,
    // clamped confidence. This makes one hallucinated id harmless.
    const validIds = new Set(existing.map((n) => String(n._id)));
    const ops = [];
    for (const o of rawOps) {
      const op = o.op;
      if (!op || !["add", "confirm", "update", "supersede"].includes(op)) continue;
      const needsId = op === "confirm" || op === "update" || op === "supersede";
      if (needsId && (!o.id || !validIds.has(String(o.id)))) continue;
      const type = o.type && NODE_TYPE_SET.has(o.type) ? o.type : undefined;
      if ((op === "add" || op === "supersede") && !o.claim) continue;
      ops.push({
        op,
        id: needsId ? (o.id as any) : undefined,
        type,
        title: o.title?.slice(0, 80),
        claim: o.claim?.slice(0, 400),
        detail: o.detail?.slice(0, 800),
        confidence: typeof o.confidence === "number" ? Math.max(0, Math.min(1, o.confidence)) : undefined,
        quote: o.quote?.slice(0, 200),
      });
    }

    if (ops.length === 0) {
      await log("ok", { opsApplied: 0, summary: "no durable knowledge" });
      return;
    }

    const applied = await ctx.runMutation(internal.knowledge.applyOps, {
      ops,
      context: {
        workspace: deal.workspace ?? "sim",
        scopeLevel: "client",
        vertical: client.vertical,
        clientId: client._id,
        source: "extracted",
        status: "active",
        at: event.at,
        eventId,
        dealId: deal._id,
      },
    });
    await log("ok", { opsApplied: applied, summary: `${client.name}: ${applied} op(s)` });
  },
});

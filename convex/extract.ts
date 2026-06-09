// ============================================================================
// Evidence-first filing — Gemini reads pasted text, uploaded files (PDF,
// images) and voice memos, and extracts values for a template's fields.
// Voice memos are transcribed first (robust, with mime fallbacks); documents
// go to the model inline. The person confirms; the machine types.
// ============================================================================

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { TEMPLATE_BY_ID, STAGE_BY_ID, applyBlueprint } from "./pipeline";
import { geminiGenerate, transcribeAudio, parseJsonLoose, toBase64 } from "./gemini";

export interface Proposal {
  fieldId: string;
  found: boolean;
  value: string;
  quote: string;
  confidence: "high" | "medium" | "low";
}

export const extract = action({
  args: {
    templateId: v.string(),
    stageId: v.string(),
    account: v.string(),
    text: v.optional(v.string()),
    fileIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, { templateId, stageId, account, text, fileIds }): Promise<Proposal[]> => {
    const bp = await ctx.runQuery(api.blueprint.get, {});
    applyBlueprint((bp?.data as never) ?? null);
    const template = TEMPLATE_BY_ID[templateId];
    if (!template) throw new Error(`Unknown template ${templateId}`);
    const stage = STAGE_BY_ID[stageId];

    const fieldSpec = template.fields.map((f) => {
      const gate = f.satisfiesGate ? stage?.exitGates.find((g) => g.id === f.satisfiesGate) : undefined;
      return {
        fieldId: f.id,
        label: (f.group ? f.group + " · " : "") + f.label,
        kind: f.kind,
        options: f.options,
        hint: f.hint,
        satisfiesGate: gate?.label,
        successCriteria: gate?.coach,
      };
    });

    const parts: Record<string, unknown>[] = [];
    if (text && text.trim()) parts.push({ text: `EVIDENCE (pasted notes):\n${text.trim()}` });

    for (const fileId of fileIds ?? []) {
      const blob = await ctx.storage.get(fileId);
      if (!blob) continue;
      const mime = blob.type || "application/octet-stream";
      if (mime.startsWith("audio/") || mime.startsWith("video/")) {
        // Voice memos: transcribe separately so a format hiccup can't sink the run.
        const t = await transcribeAudio(ctx as never, fileId as unknown as string);
        if (t.ok) {
          parts.push({ text: `EVIDENCE (voice memo, transcribed):\n${t.text}` });
        } else {
          parts.push({ text: `(A voice memo was attached but could not be transcribed: ${t.error.split(":")[0]})` });
        }
      } else {
        parts.push({ inlineData: { mimeType: mime, data: toBase64(new Uint8Array(await blob.arrayBuffer())) } });
      }
    }
    if (parts.length === 0) throw new Error("No evidence provided.");

    parts.push({
      text:
        `You extract structured CRM data for Oppr B.V. (industrial AI, sells to waste/manufacturing plants).\n` +
        `Account: ${account}. Pipeline stage: ${stage?.name ?? stageId}.\n` +
        `Template to fill: "${template.name}" (${template.discipline}).\n` +
        `Fields (successCriteria describes what a strong value looks like):\n${JSON.stringify(fieldSpec, null, 1)}\n\n` +
        `From the evidence above, extract a value for every field.\n` +
        `Rules:\n` +
        `- Only use what is actually in the evidence. If a field is not covered, found=false and value="".\n` +
        `- "check" fields: value "true" only if the evidence clearly confirms it.\n` +
        `- "select" fields: value must be one of the options, or found=false.\n` +
        `- "date" fields: ISO format YYYY-MM-DD.\n` +
        `- "currency"/"number": digits only.\n` +
        `- quote: the short evidence fragment (max 25 words) the value is based on.\n` +
        `- Write values in clean, complete sentences. No filler.\n` +
        `Return ONLY a JSON array of {fieldId, found, value, quote, confidence}.`,
    });

    const result = await geminiGenerate({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096, responseMimeType: "application/json" },
    });
    if (!result.ok) throw new Error(result.error);
    const proposals = parseJsonLoose<Proposal[]>(result.text);
    if (!proposals) throw new Error("AI returned unparseable output. Try again or fill manually.");
    const validIds = new Set(template.fields.map((f) => f.id));
    return proposals.filter((p) => p && validIds.has(p.fieldId));
  },
});

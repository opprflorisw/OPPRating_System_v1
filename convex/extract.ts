// ============================================================================
// Evidence-first filing — Gemini reads pasted text, uploaded files (PDF,
// images) and voice memos, and extracts values for a template's fields.
// The person confirms; the machine types.
// ============================================================================

import { action } from "./_generated/server";
import { v } from "convex/values";
import { TEMPLATE_BY_ID, STAGE_BY_ID } from "./pipeline";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export interface Proposal {
  fieldId: string;
  found: boolean;
  value: string;
  quote: string;
  confidence: "high" | "medium" | "low";
}

function toBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? chars[b2 & 63] : "=";
  }
  return out;
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
    const key = process.env.GOOGLE_API_KEY;
    if (!key) throw new Error("GOOGLE_API_KEY not set. Run: npx convex env set GOOGLE_API_KEY <key>");

    const template = TEMPLATE_BY_ID[templateId];
    if (!template) throw new Error(`Unknown template ${templateId}`);
    const stage = STAGE_BY_ID[stageId];

    const fieldSpec = template.fields.map((f) => ({
      fieldId: f.id,
      label: (f.group ? f.group + " · " : "") + f.label,
      kind: f.kind,
      options: f.options,
      hint: f.hint,
      satisfiesGate: f.satisfiesGate
        ? stage?.exitGates.find((g) => g.id === f.satisfiesGate)?.label
        : undefined,
    }));

    const parts: Record<string, unknown>[] = [];
    if (text && text.trim()) parts.push({ text: `EVIDENCE (pasted notes):\n${text.trim()}` });
    for (const fileId of fileIds ?? []) {
      const blob = await ctx.storage.get(fileId);
      if (!blob) continue;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let mime = blob.type || "application/octet-stream";
      // Browser voice memos are webm/opus; Gemini accepts webm as video, and
      // processes the audio track.
      if (mime.startsWith("audio/webm")) mime = "video/webm";
      parts.push({ inlineData: { mimeType: mime, data: toBase64(bytes) } });
    }
    if (parts.length === 0) throw new Error("No evidence provided.");

    parts.push({
      text:
        `You extract structured CRM data for Oppr B.V. (industrial AI, sells to waste/manufacturing plants).\n` +
        `Account: ${account}. Pipeline stage: ${stage?.name ?? stageId}.\n` +
        `Template to fill: "${template.name}" (${template.discipline}).\n` +
        `Fields:\n${JSON.stringify(fieldSpec, null, 1)}\n\n` +
        `From the evidence above (notes, documents, or a voice memo — transcribe it if audio), extract a value for every field.\n` +
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

    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "[]";
    let proposals: Proposal[];
    try {
      proposals = JSON.parse(raw) as Proposal[];
    } catch {
      throw new Error("AI returned unparseable output. Try again or fill manually.");
    }
    const validIds = new Set(template.fields.map((f) => f.id));
    return proposals.filter((p) => p && validIds.has(p.fieldId));
  },
});

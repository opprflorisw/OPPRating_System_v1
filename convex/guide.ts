// ============================================================================
// The guided interview — filing an update by talking to "a very experienced
// person for this specific gate". Gemini runs a short, chunked interview:
// it asks grouped questions, follows up on vague answers, extracts field
// values as it goes, and signals done when the template is covered.
// Voice answers (audio fileId) are transcribed in the same call.
// ============================================================================

import { action } from "./_generated/server";
import { v } from "convex/values";
import { TEMPLATE_BY_ID, STAGE_BY_ID } from "./pipeline";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export interface GuideTurn {
  reply: string; // the interviewer's next message (question, follow-up, or wrap-up)
  transcript?: string; // what the voice answer said, when audio was sent
  collected: Record<string, string>; // cumulative best-effort field values so far
  done: boolean; // true when the interview has covered what it can
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

export const step = action({
  args: {
    templateId: v.string(),
    stageId: v.string(),
    account: v.string(),
    // Prior conversation: alternating interviewer/user messages.
    history: v.array(v.object({ role: v.string(), text: v.string() })),
    // The user's newest answer — typed text and/or a voice recording.
    userText: v.optional(v.string()),
    audioFileId: v.optional(v.id("_storage")),
    // What we already know: unmet gates + the previous filing's values.
    dealContext: v.optional(v.string()),
    collected: v.optional(v.any()),
    // Ask the interviewer to wrap up with whatever it has.
    finish: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<GuideTurn> => {
    const key = process.env.GOOGLE_API_KEY;
    if (!key) throw new Error("GOOGLE_API_KEY not set. Run: npx convex env set GOOGLE_API_KEY <key>");

    const template = TEMPLATE_BY_ID[args.templateId];
    if (!template) throw new Error(`Unknown template ${args.templateId}`);
    const stage = STAGE_BY_ID[args.stageId];

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

    const system =
      `You are the most experienced sales operator at Oppr B.V. (industrial AI for waste & manufacturing plants), ` +
      `running a short structured interview to fill in the "${template.name}" record for the deal "${args.account}" ` +
      `at pipeline stage "${stage?.name ?? args.stageId}".\n\n` +
      `Fields to collect:\n${JSON.stringify(fieldSpec, null, 1)}\n\n` +
      (args.dealContext ? `What we already know about this deal:\n${args.dealContext}\n\n` : "") +
      `Interview rules:\n` +
      `- Ask 2-3 RELATED fields at a time (use the field groups), in plain conversational language. Never dump the whole list.\n` +
      `- You are a coach, not a form. If an answer is vague where precision matters (no name, no number, no date), ` +
      `push back once with a sharp follow-up — the way a great sales leader would ("Who exactly? What's their title?").\n` +
      `- If the deal context shows a previous value for a field, don't re-ask from scratch: confirm or update it ("Last time the champion was X — still true?").\n` +
      `- Prioritise fields that satisfy exit gates (satisfiesGate set), then the rest.\n` +
      `- Accept "skip" / "don't know" gracefully: leave the field out and move on.\n` +
      `- Extract values continuously: after EVERY user answer, update the collected object with everything said so far ` +
      `(cumulative — keep earlier values unless corrected). Values must be clean full sentences, dates as YYYY-MM-DD, ` +
      `numbers as digits, select fields exactly one of the options, check fields "true"/"false".\n` +
      `- When all fields are covered or skipped (or the user asks to finish), set done=true and make reply a 1-2 sentence ` +
      `wrap-up of what was captured and what's still missing.\n` +
      `- If the user's answer arrives as audio, transcribe it faithfully into the transcript field and treat it as their answer.\n` +
      `- Keep every reply under 80 words. No filler, no em dashes.\n\n` +
      `ALWAYS respond with ONLY a JSON object: {"reply": string, "transcript": string|null, ` +
      `"collected": {fieldId: value, ...}, "done": boolean}.`;

    // Build the conversation.
    const contents: Record<string, unknown>[] = [];
    for (const h of args.history) {
      contents.push({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] });
    }
    const userParts: Record<string, unknown>[] = [];
    if (args.audioFileId) {
      const blob = await ctx.storage.get(args.audioFileId);
      if (blob) {
        let mime = blob.type || "audio/webm";
        if (mime.startsWith("audio/webm")) mime = "video/webm";
        userParts.push({ inlineData: { mimeType: mime, data: toBase64(new Uint8Array(await blob.arrayBuffer())) } });
      }
    }
    const textBits: string[] = [];
    if (args.userText && args.userText.trim()) textBits.push(args.userText.trim());
    if (args.collected && Object.keys(args.collected as object).length > 0) {
      textBits.push(`(Collected so far: ${JSON.stringify(args.collected)})`);
    }
    if (args.finish) textBits.push("(The user pressed Finish — wrap up now with done=true and the final collected object.)");
    if (args.history.length === 0 && textBits.length === 0 && userParts.length === 0) {
      textBits.push("(Start the interview with a short greeting and your first grouped question.)");
    }
    if (textBits.length > 0) userParts.push({ text: textBits.join("\n") });
    if (userParts.length === 0) userParts.push({ text: "(continue)" });
    contents.push({ role: "user", parts: userParts });

    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
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
    const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "{}";
    let turn: GuideTurn;
    try {
      const parsed = JSON.parse(raw) as Partial<GuideTurn>;
      turn = {
        reply: parsed.reply ?? "Let's continue. What can you tell me?",
        transcript: parsed.transcript ?? undefined,
        collected: (parsed.collected as Record<string, string>) ?? {},
        done: Boolean(parsed.done),
      };
    } catch {
      throw new Error("The interviewer returned unparseable output. Try again.");
    }
    // Only keep values for real fields.
    const validIds = new Set(template.fields.map((f) => f.id));
    turn.collected = Object.fromEntries(
      Object.entries(turn.collected).filter(([k, val]) => validIds.has(k) && val !== "" && val !== null)
    ) as Record<string, string>;
    return turn;
  },
});

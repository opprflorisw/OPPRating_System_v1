// ============================================================================
// The guided interview — filing an update by talking to "a very experienced
// person for this specific gate". Gemini runs a short, chunked interview:
// grouped questions, coaching on what success looks like at each gate,
// follow-ups on vague answers, values extracted as it goes.
// Voice answers are transcribed FIRST (separate, robust call), then fed into
// the interview as text — so one flaky audio call can never break the chat.
// ============================================================================

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { TEMPLATE_BY_ID, STAGE_BY_ID, applyBlueprint } from "./pipeline";
import { MEDDIC_RUBRIC, PRINCIPLES } from "./library";
import { geminiGenerate, transcribeAudio, parseJsonLoose } from "./gemini";

export interface GuideTurn {
  reply: string;
  transcript?: string;
  collected: Record<string, string>;
  done: boolean;
  error?: boolean; // soft failure — chat stays alive
}

export const step = action({
  args: {
    templateId: v.string(),
    stageId: v.string(),
    account: v.string(),
    history: v.array(v.object({ role: v.string(), text: v.string() })),
    userText: v.optional(v.string()),
    audioFileId: v.optional(v.id("_storage")),
    dealContext: v.optional(v.string()),
    collected: v.optional(v.any()),
    finish: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<GuideTurn> => {
    const bp = await ctx.runQuery(api.blueprint.get, {});
    applyBlueprint((bp?.data as never) ?? null);
    const template = TEMPLATE_BY_ID[args.templateId];
    const stage = STAGE_BY_ID[args.stageId];
    const prevCollected = (args.collected as Record<string, string>) ?? {};
    const soft = (msg: string): GuideTurn => ({
      reply: msg, collected: prevCollected, done: false, error: true,
    });
    if (!template) return soft("Unknown template — close this dialog and try again.");

    // 1. Voice answers: transcribe first, in a dedicated robust call.
    let transcript: string | undefined;
    if (args.audioFileId) {
      const t = await transcribeAudio(ctx as never, args.audioFileId as unknown as string);
      if (!t.ok) {
        return soft(
          `⚠️ I couldn't process that recording (${t.error.split(":")[0]}). ` +
          `Try recording again — shorter is fine — or just type your answer.`
        );
      }
      transcript = t.text.trim();
    }

    // 2. The interview turn, text-only and structured.
    const fieldSpec = template.fields.map((f) => {
      const gate = f.satisfiesGate ? stage?.exitGates.find((g) => g.id === f.satisfiesGate) : undefined;
      return {
        fieldId: f.id,
        label: (f.group ? f.group + " · " : "") + f.label,
        kind: f.kind,
        options: f.options,
        hint: f.hint,
        satisfiesGate: gate ? `${gate.code} — ${gate.label}` : undefined,
        successCriteria: gate?.coach,
      };
    });

    const rubric =
      args.templateId === "meddic_snapshot"
        ? `\nMEDDIC scoring rubric (use it to coach scores honestly):\n` +
          MEDDIC_RUBRIC.map((r) => `${r.letter} ${r.label}: 1-2 = ${r.low} | 3 = ${r.mid} | 4-5 = ${r.high}`).join("\n")
        : "";

    const system =
      `You are the most experienced sales operator at Oppr B.V. (industrial AI for waste & manufacturing plants), ` +
      `running a short structured interview to fill the "${template.name}" record for the deal "${args.account}" ` +
      `at pipeline stage "${stage?.name ?? args.stageId}". You are a COACH, not a form: your job is that the user ` +
      `ends up with a record that actually passes the gates, and understands WHY each gate matters.\n\n` +
      `Operating principles of this sales motion:\n${PRINCIPLES.map((p) => "- " + p).join("\n")}\n` +
      rubric +
      `\n\nFields to collect (successCriteria = what a GOOD answer looks like for that gate — use it):\n` +
      `${JSON.stringify(fieldSpec, null, 1)}\n\n` +
      (args.dealContext ? `What we already know about this deal:\n${args.dealContext}\n\n` : "") +
      `Interview rules:\n` +
      `- HARD RULE: fields listed under "ALREADY ON FILE" have their gates satisfied. NEVER ask about them. ` +
      `In your FIRST message, acknowledge them in one compact line (e.g. "✓ Already on file: core problem, urgency, ICP fit") ` +
      `and go straight to what is STILL MISSING. Only touch a satisfied field if the user volunteers new information about it.\n` +
      `- If the context says ALL exit gates are met, open by saying the stage is complete and the user can advance — ` +
      `then offer to capture anything new. Do not interview for the sake of it.\n` +
      `- Ask ONE question at a time. You may pair two tightly-linked fields in a single question, never more. ` +
      `Sound like a colleague on a call, not a form: react in half a sentence to what was just said, then ask the next thing.\n` +
      `- Requirements are numbered (the gate codes like D3 or SV5). When you reference a requirement, cite its code in ` +
      `parentheses so the user can follow along against the gate list, e.g. "...the urgency **(D2)**".\n` +
      `- COACH as you ask: when a field has successCriteria, weave in what success looks like, briefly. ` +
      `Example: instead of "What are the success criteria?", say "What did you agree success looks like? ` +
      `**Tip:** define it on what Oppr controls (decision latency, hours saved), never on KPIs we don't control — that's the classic PoC trap."\n` +
      `- ALERT proactively: if the deal context or an answer reveals a risk (EB not engaged, no EUR case, ` +
      `single-threaded champion, stale MEDDIC, paper unmapped), flag it in one bold sentence and say what to do about it.\n` +
      `- If an answer is vague where precision matters (no name, no number, no date), push back once, sharply but kindly.\n` +
      `- If the deal context shows a previous value, confirm or update it rather than re-asking from scratch.\n` +
      `- Prioritise gate-satisfying fields, then the rest. Accept "skip" / "don't know" gracefully.\n` +
      `- Use markdown in replies: **bold** for the key term or warning, bullet lists when you ask multiple things, *italics* for examples. Keep replies under 110 words.\n` +
      `- Extract values continuously: after EVERY user answer, update collected with everything said so far ` +
      `(cumulative, keep earlier values unless corrected). Clean full sentences; dates YYYY-MM-DD; numbers as digits; ` +
      `select fields exactly one of the options; check fields "true"/"false".\n` +
      `- When everything missing is covered or skipped (or the user asks to finish), set done=true and wrap up in 2-3 sentences: ` +
      `what was captured, **what is still missing and why it matters** (use the successCriteria), and if all gates are now ` +
      `covered, say explicitly: "After filing, this stage is ready to advance."\n` +
      `- No em dashes. Be the colleague everyone wishes they had on their first deal.\n\n` +
      `ALWAYS respond with ONLY a JSON object: {"reply": string (markdown), "collected": {fieldId: value, ...}, "done": boolean}.`;

    const contents: Record<string, unknown>[] = args.history.map((h) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.text }],
    }));
    const textBits: string[] = [];
    if (transcript) textBits.push(`(Voice answer, transcribed) ${transcript}`);
    if (args.userText && args.userText.trim()) textBits.push(args.userText.trim());
    if (Object.keys(prevCollected).length > 0) textBits.push(`(Collected so far: ${JSON.stringify(prevCollected)})`);
    if (args.finish) textBits.push("(The user pressed Finish — wrap up now with done=true and the final collected object.)");
    if (args.history.length === 0 && textBits.length === 0) {
      textBits.push("(Start the interview: one short line on what this record is for and why it matters at this stage, then your first grouped question.)");
    }
    contents.push({ role: "user", parts: [{ text: textBits.join("\n") || "(continue)" }] });

    const result = await geminiGenerate({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048, responseMimeType: "application/json" },
    });
    if (!result.ok) {
      return soft(`⚠️ The interviewer hit a snag (${result.error.split(":")[0]}). Your answers are safe — try sending that again.`);
    }
    const parsed = parseJsonLoose<Partial<GuideTurn>>(result.text);
    if (!parsed) {
      return soft("⚠️ I garbled my own notes there. Say that again and I'll pick it back up.");
    }

    const validIds = new Set(template.fields.map((f) => f.id));
    const collected = Object.fromEntries(
      Object.entries({ ...prevCollected, ...(parsed.collected ?? {}) }).filter(
        ([k, val]) => validIds.has(k) && val !== "" && val !== null && val !== undefined
      )
    ) as Record<string, string>;

    return {
      reply: parsed.reply ?? "Let's continue. What can you tell me?",
      transcript,
      collected,
      done: Boolean(parsed.done),
    };
  },
});

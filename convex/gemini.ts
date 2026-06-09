// ============================================================================
// Shared Gemini plumbing — one battle-tested caller, audio transcription with
// mime fallbacks, base64. Actions should return friendly errors, not throw.
// ============================================================================

import type { GenericActionCtx } from "convex/server";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export function toBase64(bytes: Uint8Array): string {
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

export type GeminiResult = { ok: true; text: string } | { ok: false; error: string };

export async function geminiGenerate(body: Record<string, unknown>): Promise<GeminiResult> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return { ok: false, error: "GOOGLE_API_KEY is not set on this Convex deployment." };
  let res: Response;
  try {
    res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: `Network error reaching Gemini: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    return { ok: false, error: `Gemini API error ${res.status}: ${detail}` };
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) return { ok: false, error: "Gemini returned an empty answer." };
  return { ok: true, text };
}

// Transcribe a stored voice recording. Browser MediaRecorder produces
// webm/opus; Gemini accepts webm only as video, so we try video/webm first
// and fall back through other audio labels.
export async function transcribeAudio(
  ctx: GenericActionCtx<Record<string, never>>,
  fileId: string
): Promise<GeminiResult> {
  const blob = await ctx.storage.get(fileId as never);
  if (!blob) return { ok: false, error: "The recording could not be found in storage." };
  if (blob.size > 18 * 1024 * 1024) {
    return { ok: false, error: "The recording is too large (>18MB). Keep voice answers under a few minutes." };
  }
  const data = toBase64(new Uint8Array(await blob.arrayBuffer()));
  const original = blob.type || "audio/webm";
  const candidates = original.startsWith("audio/webm")
    ? ["video/webm", "audio/ogg", original]
    : [original, "video/webm"];
  let lastError = "unknown error";
  for (const mime of candidates) {
    const result = await geminiGenerate({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: mime, data } },
            { text: "Transcribe this voice note verbatim (it may be Dutch or English). Reply with ONLY the transcript text, nothing else." },
          ],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 2048 },
    });
    if (result.ok) return result;
    lastError = result.error;
    // Only retry on format-style rejections.
    if (!/400|INVALID_ARGUMENT|unsupported/i.test(lastError)) break;
  }
  return { ok: false, error: lastError };
}

export function parseJsonLoose<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Strip markdown fences if the model wrapped the JSON anyway.
    const m = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) {
      try { return JSON.parse(m[0]) as T; } catch { return null; }
    }
    return null;
  }
}

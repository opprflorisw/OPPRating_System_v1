// ============================================================================
// Chat with the data — Google AI (Gemini) reads the full deal records and
// answers questions or generates the weekly review from the template.
// Set the key once:  npx convex env set GOOGLE_API_KEY <key>
// ============================================================================

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { replay, gateProgress, fmtEur } from "./derive";
import { STAGE_BY_ID, type DealEvent } from "./pipeline";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM = `You are the RevOps analyst inside the OPPRating System, the commercial
engine of Oppr B.V. (the Human Data Layer for Manufacturing — LOGS captures operator
observations, IDA finds patterns, DOCS turns them into living standards).

The pipeline follows the Pipeline Operating Manual: Lead > Discovery > Solution
Validation (CP1: full MEDDIC before any POC paper) > POC (CP2: MEDDIC refreshed) >
Procurement & Negotiation (CP3: Commit forecast requires MEDDIC reviewed within 14
days) > Closed Won (= signed yearly ARR contract, nothing else counts). Stagnated is
a parking state with a reactivation date; Closed Lost needs a mandatory reason.

You receive the current state of every deal as JSON, replayed from append-only event
logs as of a given date. All deal data is SIMULATED demo data on real named target
accounts.

Rules for answering:
- Be direct and numerate. Euros, days, counts. No filler.
- Surface gaps the way a good sales leader would: unmet gates, stale MEDDIC,
  unengaged Economic Buyers, rotting deals (>60 days in stage), open override flags.
- When asked for a report, use tables. Currency is EUR.
- Never invent data that is not in the JSON. If something is unknown, say so.
- Short sentences. No em dashes.`;

interface DealWithEvents {
  _id: string;
  slug: string;
  account: string;
  site: string;
  acv: number;
  pocFee?: number;
  owner: string;
  hook: string;
  events: (DealEvent & { _id: string })[];
}

function buildContext(deals: DealWithEvents[], asOf: string): string {
  const rows = deals.map((d) => {
    const state = replay(d.events, d.acv, asOf);
    const stage = STAGE_BY_ID[state.stageId];
    const progress = gateProgress(stage, state);
    const recent = d.events
      .filter((e) => e.at <= asOf)
      .slice(-5)
      .map((e) => ({
        at: e.at,
        type: e.type,
        template: e.templateId,
        author: e.author,
        note: e.note,
        summary: e.payload ? JSON.stringify(e.payload).slice(0, 400) : undefined,
      }));
    return {
      account: d.account,
      site: d.site,
      acv: d.acv,
      stage: stage.name,
      forecastCategory: state.forecastCategory,
      weightedValue: state.weighted,
      daysInStage: state.daysInStage,
      daysSinceLastTouch: state.daysSinceTouch,
      health: state.health,
      blocker: state.blocker || undefined,
      gates: `${progress.done}/${progress.total} exit gates met`,
      unmetGates: stage.exitGates.filter((g) => !state.gates[g.id]).map((g) => g.label),
      openOverrideFlags: state.overrides.filter((o) => !o.resolved).map((o) => o.note),
      meddicLastReviewed: state.meddic?.at,
      meddic: state.meddic?.payload,
      disposition: state.disposition,
      recentEvents: recent,
    };
  });
  return JSON.stringify({ asOf, deals: rows }, null, 1);
}

async function callGemini(system: string, user: string): Promise<string> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) {
    return "GOOGLE_API_KEY is not set. Run: npx convex env set GOOGLE_API_KEY <your key from aistudio.google.com>";
  }
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return `Gemini API error ${res.status}: ${body.slice(0, 300)}`;
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return text || "No answer returned.";
}

export const ask = action({
  args: { question: v.string(), asOf: v.string() },
  handler: async (ctx, { question, asOf }): Promise<string> => {
    const deals = (await ctx.runQuery(api.deals.list, {})) as unknown as DealWithEvents[];
    const context = buildContext(deals, asOf);
    return await callGemini(
      SYSTEM,
      `Pipeline state as of ${asOf}:\n${context}\n\nQuestion: ${question}`
    );
  },
});

// Monday stand-up brief — built on the DELTAS between this week and last week
// (stage moves, MEDDIC letter changes, blockers opened/resolved), not on the
// underlying templates.
export const standup = action({
  args: { asOf: v.string() },
  handler: async (ctx, { asOf }): Promise<string> => {
    const deals = (await ctx.runQuery(api.deals.list, {})) as unknown as DealWithEvents[];
    const lastWeek = new Date(new Date(asOf).getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const now = buildContext(deals, asOf);
    const prev = buildContext(deals, lastWeek);
    return await callGemini(
      SYSTEM,
      `State LAST MONDAY (${lastWeek}):\n${prev}\n\nState TODAY (${asOf}):\n${now}\n\n` +
        `Write the Monday morning stand-up brief for the sales leader, week starting ${asOf}. ` +
        `Compare the two states and work from the CHANGES:\n` +
        `1. One headline paragraph: how the week really went (honest, no cheerleading).\n` +
        `2. "Moved": deals that progressed — stage moves, MEDDIC letters that improved (e.g. "EEW: E 2 -> 3"), gates passed.\n` +
        `3. "Stalled or slipped": deals with no movement, scores flat or down, new blockers, rotting risk.\n` +
        `4. "Blockers to break": each open blocker, who owns it, the suggested unblock.\n` +
        `5. "The 3 conversations this week": the highest-leverage actions, each with a named deal and what to ask for.\n` +
        `Keep it under 350 words. Plain language. EUR for money. Mark as SIMULATED DATA at the top.`
    );
  },
});

export const weeklyReview = action({
  args: { asOf: v.string() },
  handler: async (ctx, { asOf }): Promise<string> => {
    const deals = (await ctx.runQuery(api.deals.list, {})) as unknown as DealWithEvents[];
    const context = buildContext(deals, asOf);
    const totalOpen = deals.length;
    return await callGemini(
      SYSTEM,
      `Pipeline state as of ${asOf} (${totalOpen} deals):\n${context}\n\n` +
        `Generate the Oppr Weekly Company Review for the week ending ${asOf}, following this template:\n\n` +
        `# Oppr — Weekly Commercial Review · week ending ${asOf}\n` +
        `**Headline KPIs:** total open pipeline EUR (sum of open-deal ACV), weighted forecast EUR, ` +
        `closed-won ARR to date, deal count per stage.\n\n` +
        `Then a table with one row per discipline (Marketing, Sales, Implementation & Support, RevOps):\n` +
        `| Discipline | Status (R/A/G) | Key number | What moved (last 7 days) | Stuck / action |\n\n` +
        `Then a section "Deal-level flags" listing every deal that needs leadership attention and why ` +
        `(unmet CP gates, EB gaps, stale MEDDIC, rotting, override flags, offers stuck in legal).\n` +
        `Close with "Top 3 actions for next week", each with an owner.\n` +
        `Use only the data provided. Mark the whole report as SIMULATED DATA at the top.`
    );
  },
});

// ============================================================================
// Chat with the data — Google AI (Gemini) reads the full deal records and
// answers questions or generates the stand-up / weekly review.
// Replies are markdown and may contain record links the UI resolves:
//   [Attero](deal:attero-wijster)  → opens the deal record
//   [MEDDIC history](meddic:attero-wijster) → opens the client MEDDIC page
// ============================================================================

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { replay, gateProgress, meddicHistory, meddicPct, letterScore } from "./derive";
import { STAGE_BY_ID, MEDDIC_LETTERS, type DealEvent } from "./pipeline";
import { geminiGenerate } from "./gemini";

const SYSTEM = `You are the RevOps analyst inside the OPPRating System, the commercial
engine of Oppr B.V. (the Human Data Layer for Manufacturing — LOGS captures operator
observations, IDA finds patterns, DOCS turns them into living standards).

The pipeline follows the Pipeline Operating Manual: Lead > Discovery > Solution
Validation (CP1: full MEDDIC before any POC paper) > POC (CP2: MEDDIC refreshed) >
Procurement & Negotiation (CP3: Commit forecast requires MEDDIC reviewed within 14
days) > Closed Won (= signed yearly ARR contract, nothing else counts). Stagnated is
a parking state with a reactivation date; Closed Lost needs a mandatory reason.

You receive the current state of every deal as JSON, replayed from append-only event
logs as of a given date — including the FULL MEDDIC snapshot history per deal (every
snapshot, scored 1-5 per letter), so you can analyse trajectories, not just the latest
state.

Formatting rules:
- Markdown, used well: **bold** for the load-bearing fact or warning, bullet lists,
  ### headings for sections, tables for comparisons. Make it scannable.
- Whenever you mention a deal, link it: [Account · Site](deal:SLUG) using the slug
  from the data. When you point at MEDDIC history, link [MEDDIC history](meddic:SLUG).
  These links open the records in the app — use them generously so the reader can
  retrace every claim.
- Be direct and numerate. Euros, days, counts, score deltas. No filler, no em dashes.
- Surface gaps like a good sales leader: unmet gates, stale or flat MEDDIC scores,
  unengaged Economic Buyers, rotting deals (>60 days in stage), open override flags.
- Never invent data that is not in the JSON. If something is unknown, say so.`;

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
      .slice(-8)
      .map((e) => ({
        at: e.at,
        type: e.type,
        template: e.templateId,
        author: e.author,
        note: e.note,
        summary: e.payload ? JSON.stringify(e.payload).slice(0, 320) : undefined,
      }));
    // Full snapshot history: scores + gaps + verdict per snapshot.
    const meddicTrail = meddicHistory(d.events, asOf).map((s) => ({
      at: s.at,
      author: s.author,
      overallPct: meddicPct(s.payload),
      letters: Object.fromEntries(
        MEDDIC_LETTERS.map((m) => [
          `${m.letter} ${m.label}`,
          {
            score: letterScore(s.payload, m.key),
            state: String(s.payload[m.key] ?? "").slice(0, 180),
            gap: String(s.payload[`${m.key}_gap`] ?? "").slice(0, 140) || undefined,
          },
        ])
      ),
      verdict: String(s.payload["verdict"] ?? "") || undefined,
      blocker: String(s.payload["blocker"] ?? "") || undefined,
    }));
    return {
      slug: d.slug,
      account: d.account,
      site: d.site,
      acv: d.acv,
      owner: d.owner,
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
      meddicSnapshotHistory: meddicTrail,
      disposition: state.disposition,
      recentEvents: recent,
    };
  });
  return JSON.stringify({ asOf, deals: rows }, null, 1);
}

async function run(system: string, user: string, maxTokens = 4096): Promise<string> {
  const result = await geminiGenerate({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
  });
  return result.ok ? result.text : `⚠️ ${result.error}`;
}

function simNote(workspace?: string): string {
  return (workspace ?? "sim") === "sim"
    ? "\nThis is the SIMULATION workspace — note once at the top that data is simulated, then analyse it seriously."
    : "\nThis is the LIVE workspace with real data. Do not call it simulated.";
}

export const ask = action({
  args: { question: v.string(), asOf: v.string(), workspace: v.optional(v.string()) },
  handler: async (ctx, { question, asOf, workspace }): Promise<string> => {
    const deals = (await ctx.runQuery(api.deals.list, { workspace })) as unknown as DealWithEvents[];
    const context = buildContext(deals, asOf);
    return await run(
      SYSTEM,
      `Pipeline state as of ${asOf}:\n${context}\n${simNote(workspace)}\n\nQuestion: ${question}`
    );
  },
});

// Monday stand-up brief — built on the DELTAS between this week and last week.
export const standup = action({
  args: { asOf: v.string(), workspace: v.optional(v.string()) },
  handler: async (ctx, { asOf, workspace }): Promise<string> => {
    const deals = (await ctx.runQuery(api.deals.list, { workspace })) as unknown as DealWithEvents[];
    const lastWeek = new Date(new Date(asOf).getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const now = buildContext(deals, asOf);
    const prev = buildContext(deals, lastWeek);
    return await run(
      SYSTEM,
      `State LAST MONDAY (${lastWeek}):\n${prev}\n\nState TODAY (${asOf}):\n${now}\n${simNote(workspace)}\n\n` +
        `Write the Monday morning stand-up brief for the sales leader, week starting ${asOf}. ` +
        `Work strictly from the CHANGES between the two states. Structure (markdown, with deal links everywhere):\n` +
        `### How the week really went\nOne honest paragraph — no cheerleading. Name the single most important development and the single biggest worry.\n` +
        `### Moved\nPer deal that progressed: stage moves, MEDDIC letters that improved with the delta (e.g. **E: 2 → 3**), gates passed, blockers resolved. Why it matters in one clause.\n` +
        `### Stalled or slipped\nDeals with no movement, scores flat or down, new blockers, rotting risk (days in stage). Be specific about what flat means for each.\n` +
        `### Blockers to break\nA table: deal (linked) | blocker | owner | the concrete unblock move.\n` +
        `### The 3 conversations this week\nThe highest-leverage actions. Each: the deal (linked), who to talk to, exactly what to ask for, and what changes if it lands.\n` +
        `Keep it under 550 words. Every deal mention is a link.`
    );
  },
});

export const weeklyReview = action({
  args: { asOf: v.string(), workspace: v.optional(v.string()) },
  handler: async (ctx, { asOf, workspace }): Promise<string> => {
    const deals = (await ctx.runQuery(api.deals.list, { workspace })) as unknown as DealWithEvents[];
    const context = buildContext(deals, asOf);
    return await run(
      SYSTEM,
      `Pipeline state as of ${asOf} (${deals.length} deals):\n${context}\n${simNote(workspace)}\n\n` +
        `Generate the Oppr Weekly Commercial Review for the week ending ${asOf} (markdown):\n` +
        `**Headline KPIs:** total open pipeline EUR, weighted forecast EUR, Commit EUR, closed-won ARR, deal count per stage.\n` +
        `Then a table, one row per discipline (Marketing, Sales, Implementation & Support, RevOps): Status (R/A/G) | key number | what moved | stuck / action.\n` +
        `Then **Deal-level flags**: every deal needing leadership attention and why (unmet CP gates, EB gaps, stale or flat MEDDIC, rotting, overrides, paper stuck) — each linked.\n` +
        `Close with **Top 3 actions for next week**, each with an owner.\n` +
        `Use only the data provided.`
    );
  },
});

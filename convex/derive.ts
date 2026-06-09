// ============================================================================
// Derivation — the record card is an append-only event log; everything else
// (current stage, gate state, health, forecast) is replayed from it.
// Pure functions, shared by frontend and backend. `asOf` makes time travel free.
// ============================================================================

import { STAGE_BY_ID, type DealEvent, type Stage } from "./pipeline";

export interface GateEvidence {
  at: string;
  author: string;
  via: string; // template name / note
}

export interface OverrideFlag {
  at: string;
  fromStage: string;
  note?: string;
  missing: string[]; // gate ids still unmet as of `asOf`
  resolved: boolean;
}

export interface DealState {
  stageId: string;
  stageEnteredAt: string;
  gates: Record<string, GateEvidence>;
  overrides: OverrideFlag[];
  disposition?: { kind: string; reason: string; detail?: string; reactivation?: string };
  meddic?: { at: string; payload: Record<string, unknown> };
  blocker: string;
  lastEventAt: string;
  daysInStage: number;
  daysSinceTouch: number;
  health: "G" | "A" | "R";
  forecastCategory: string;
  weighted: number;
  eventCount: number;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function replay(events: DealEvent[], acv: number, asOf: string): DealState {
  const visible = events
    .filter((e) => e.at <= asOf)
    .slice()
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  let stageId = "lead";
  let stageEnteredAt = visible.length ? visible[0].at : asOf;
  const gates: Record<string, GateEvidence> = {};
  const rawOverrides: { at: string; fromStage: string; note?: string }[] = [];
  let disposition: DealState["disposition"];
  let meddic: DealState["meddic"];
  let blocker = "";
  let lastEventAt = visible.length ? visible[visible.length - 1].at : asOf;

  for (const e of visible) {
    if (e.gatesSatisfied) {
      for (const g of e.gatesSatisfied) {
        if (!gates[g]) gates[g] = { at: e.at, author: e.author, via: e.templateId ?? e.type };
      }
    }
    if (e.type === "stage" && e.to) {
      if (e.override) rawOverrides.push({ at: e.at, fromStage: e.from ?? stageId, note: e.note });
      stageId = e.to;
      stageEnteredAt = e.at;
    }
    if (e.type === "template" && e.templateId === "meddic_snapshot" && e.payload) {
      meddic = { at: e.at, payload: e.payload as Record<string, unknown> };
    }
    if (e.type === "template" && e.templateId === "disposition" && e.payload) {
      const p = e.payload as Record<string, string>;
      disposition = { kind: p.kind, reason: p.reason, detail: p.detail, reactivation: p.reactivation };
    }
    if (e.payload && typeof (e.payload as Record<string, unknown>).blocker === "string") {
      blocker = (e.payload as Record<string, string>).blocker;
    }
  }

  const overrides: OverrideFlag[] = rawOverrides.map((o) => {
    const fromStage = STAGE_BY_ID[o.fromStage];
    const missing = fromStage ? fromStage.exitGates.filter((g) => !gates[g.id]).map((g) => g.id) : [];
    return { ...o, missing, resolved: missing.length === 0 };
  });

  const stage = STAGE_BY_ID[stageId];
  const daysInStage = daysBetween(stageEnteredAt, asOf);
  const daysSinceTouch = daysBetween(lastEventAt, asOf);

  const open = !stage.terminal && !stage.parking;
  const unresolvedOverride = overrides.some((o) => !o.resolved);
  let health: "G" | "A" | "R" = "G";
  if (open) {
    if (daysInStage > 60 || unresolvedOverride || (blocker && daysSinceTouch > 14)) health = "R";
    else if (blocker || daysInStage > 30 || daysSinceTouch > 21) health = "A";
  }

  // Forecast: Commit requires CP3 — MEDDIC reviewed within 14 days (operating manual).
  let forecastCategory: string = stage.forecastCategory;
  if (stageId === "negotiation") {
    const fresh = meddic && daysBetween(meddic.at, asOf) <= 14;
    forecastCategory = fresh ? "Commit" : "Upside";
  }
  const weighted = open ? Math.round((acv * stage.probability) / 100) : stageId === "closed_won" ? acv : 0;

  return {
    stageId,
    stageEnteredAt,
    gates,
    overrides,
    disposition,
    meddic,
    blocker,
    lastEventAt,
    daysInStage,
    daysSinceTouch,
    health,
    forecastCategory,
    weighted,
    eventCount: visible.length,
  };
}

export function gateProgress(stage: Stage, state: DealState): { done: number; total: number } {
  const total = stage.exitGates.length;
  const done = stage.exitGates.filter((g) => state.gates[g.id]).length;
  return { done, total };
}

export function fmtEur(n: number): string {
  return "€" + n.toLocaleString("en-IE", { maximumFractionDigits: 0 });
}

// ── MEDDIC as the snapshot spine ────────────────────────────────────────────

export interface MeddicSnapshot {
  at: string;
  author: string;
  payload: Record<string, unknown>;
}

export function meddicHistory(events: DealEvent[], asOf: string): MeddicSnapshot[] {
  return events
    .filter((e) => e.at <= asOf && e.type === "template" && e.templateId === "meddic_snapshot" && e.payload)
    .slice()
    .sort((a, b) => (a.at < b.at ? -1 : 1))
    .map((e) => ({ at: e.at, author: e.author, payload: e.payload as Record<string, unknown> }));
}

const LETTER_KEYS = ["metrics", "eb", "criteria", "process", "pain", "champion"] as const;

export function letterScore(payload: Record<string, unknown>, key: string): number | null {
  const raw = payload[`${key}_score`];
  const n = typeof raw === "string" ? parseInt(raw, 10) : typeof raw === "number" ? raw : NaN;
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

// Overall MEDDIC health as a percentage of 30 (six letters x 5), like the
// Attero review's 17.5/30 = 58%.
export function meddicPct(payload: Record<string, unknown>): number | null {
  const scores = LETTER_KEYS.map((k) => letterScore(payload, k)).filter((s): s is number => s !== null);
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / (scores.length * 5)) * 100);
}

export interface LetterDelta {
  key: string;
  prevScore: number | null;
  currScore: number | null;
  scoreDelta: number | null;
  textChanged: boolean;
}

export function diffMeddic(
  prev: Record<string, unknown> | undefined,
  curr: Record<string, unknown>
): LetterDelta[] {
  return LETTER_KEYS.map((key) => {
    const prevScore = prev ? letterScore(prev, key) : null;
    const currScore = letterScore(curr, key);
    return {
      key,
      prevScore,
      currScore,
      scoreDelta: prevScore !== null && currScore !== null ? currScore - prevScore : null,
      textChanged: prev ? String(prev[key] ?? "") !== String(curr[key] ?? "") : true,
    };
  });
}

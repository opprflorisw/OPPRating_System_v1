// ============================================================================
// Derivation — the record card is an append-only event log; everything else
// (current stage, gate state, health, forecast) is replayed from it.
// Pure functions, shared by frontend and backend. `asOf` makes time travel free.
// ============================================================================

import {
  STAGE_BY_ID, STAGES, TEMPLATES, TEMPLATE_BY_ID, provInfo,
  type DealEvent, type Stage, type ProvenanceInfo,
} from "./pipeline";

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

// ── The provenance chain: gate → field → filings → evidence ────────────────

// Which (template, field) pairs can satisfy each gate. Computed on demand so
// it always reflects the active (possibly DB-edited) blueprint.
function gateFieldMap(): Record<string, { templateId: string; fieldId: string }[]> {
  const map: Record<string, { templateId: string; fieldId: string }[]> = {};
  for (const t of TEMPLATES) {
    for (const f of t.fields) {
      if (f.satisfiesGate) (map[f.satisfiesGate] ??= []).push({ templateId: t.id, fieldId: f.id });
    }
  }
  return map;
}

export interface GateEntry {
  at: string;
  author: string;
  templateId?: string;
  value: string;
  kind: "passed" | "reaffirmed" | "updated";
  prov: ProvenanceInfo | null;
  changed: boolean; // value differs from the previous entry
  hasEvidence: boolean; // the filing carried raw evidence (text or attachments)
}

// Every touch of every gate, in order: the first satisfying filing ("passed"),
// later filings that list it again ("reaffirmed"), and later filings whose
// satisfying field carries a DIFFERENT value without re-listing the gate
// ("updated" — the ↻ drift marker).
export function gateLedger(events: DealEvent[], asOf: string): Record<string, GateEntry[]> {
  const sorted = events
    .filter((e) => e.at <= asOf)
    .slice()
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const ledger: Record<string, GateEntry[]> = {};
  const gateFields = gateFieldMap();

  for (const e of sorted) {
    const listed = new Set(e.gatesSatisfied ?? []);
    const touched = new Map<string, { value: string; fieldId: string }>();
    if (e.type === "template" && e.payload && e.templateId) {
      for (const [gateId, pairs] of Object.entries(gateFields)) {
        for (const p of pairs) {
          if (p.templateId !== e.templateId) continue;
          const v = (e.payload as Record<string, unknown>)[p.fieldId];
          if (v === undefined || v === null || v === "" || v === false) continue;
          touched.set(gateId, { value: typeof v === "boolean" ? "Confirmed" : String(v), fieldId: p.fieldId });
        }
      }
    }
    const gateIds = new Set([...listed, ...touched.keys()]);
    for (const gateId of gateIds) {
      const entries = (ledger[gateId] ??= []);
      const t = touched.get(gateId);
      const value = t?.value ?? e.note ?? (e.templateId ? `Filed ${TEMPLATE_BY_ID[e.templateId]?.name ?? e.templateId}` : e.type);
      const prevValue = entries.length ? entries[entries.length - 1].value : null;
      const changed = prevValue !== null && prevValue !== value;
      const isListed = listed.has(gateId);
      // A repeat filing with an identical value and no explicit re-listing
      // carries no signal — skip it.
      if (!isListed && !changed && entries.length > 0) continue;
      entries.push({
        at: e.at,
        author: e.author,
        templateId: e.templateId,
        value,
        kind: isListed ? (entries.some((x) => x.kind === "passed") ? "reaffirmed" : "passed") : "updated",
        prov: t ? provInfo(e.provenance, t.fieldId) : null,
        changed,
        hasEvidence: Boolean(e.evidenceText || (e.attachments && e.attachments.length > 0)),
      });
    }
  }
  return ledger;
}

// ↻ drift: the gate passed on one value and the latest value differs.
export function gateDrift(entries: GateEntry[] | undefined): { from: string; to: string; at: string } | null {
  if (!entries) return null;
  const passed = entries.find((x) => x.kind === "passed");
  if (!passed) return null;
  const last = entries[entries.length - 1];
  return last.value !== passed.value ? { from: passed.value, to: last.value, at: last.at } : null;
}

// The staircase: which stages this deal has been through, with entry/exit dates.
export interface StageVisit {
  stageId: string;
  enteredAt: string;
  exitedAt: string | null;
}

export function stageHistory(events: DealEvent[], asOf: string): StageVisit[] {
  const sorted = events
    .filter((e) => e.at <= asOf)
    .slice()
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const visits: StageVisit[] = [{ stageId: "lead", enteredAt: sorted[0]?.at ?? asOf, exitedAt: null }];
  for (const e of sorted) {
    if (e.type === "stage" && e.to) {
      visits[visits.length - 1].exitedAt = e.at;
      visits.push({ stageId: e.to, enteredAt: e.at, exitedAt: null });
    }
  }
  return visits;
}

// What a filing actually changed vs the previous filing of the same template —
// the old → new diff behind a condensed activity row.
export interface FieldChange {
  fieldId: string;
  label: string;
  group?: string;
  oldValue: string | null;
  newValue: string;
  prov: ProvenanceInfo | null;
  satisfiesGate?: string;
}

export function eventFieldChanges(events: DealEvent[], event: DealEvent): FieldChange[] {
  if (event.type !== "template" || !event.payload || !event.templateId) return [];
  const tpl = TEMPLATE_BY_ID[event.templateId];
  if (!tpl) return [];
  const sorted = events
    .filter((e) => e.type === "template" && e.templateId === event.templateId)
    .slice()
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const idx = sorted.indexOf(event);
  const prev = idx > 0 ? (sorted[idx - 1].payload as Record<string, unknown>) : null;
  const changes: FieldChange[] = [];
  for (const f of tpl.fields) {
    const raw = (event.payload as Record<string, unknown>)[f.id];
    if (raw === undefined || raw === null || raw === "") continue;
    const newValue = typeof raw === "boolean" ? (raw ? "Confirmed" : "No") : String(raw);
    const prevRaw = prev?.[f.id];
    const oldValue =
      prevRaw === undefined || prevRaw === null || prevRaw === ""
        ? null
        : typeof prevRaw === "boolean" ? (prevRaw ? "Confirmed" : "No") : String(prevRaw);
    if (oldValue === newValue) continue; // unchanged — not part of the delta
    changes.push({
      fieldId: f.id,
      label: (f.group ? f.group + " · " : "") + f.label,
      group: f.group,
      oldValue,
      newValue,
      prov: provInfo(event.provenance, f.id),
      satisfiesGate: f.satisfiesGate,
    });
  }
  return changes;
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

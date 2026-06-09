import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  STAGES, TEMPLATES, boardStages,
  type Stage, type Template, type Gate, type TemplateField,
} from "../../convex/pipeline";

// ============================================================================
// The Process page — the whole pipeline left to right: what is filed at every
// stage, by whom, which numbered gates it satisfies, and how MEDDIC enters
// and matures. Doubles as the blueprint editor: changes are saved to the
// database and override the built-in defaults everywhere (board, chat, AI).
// ============================================================================

const MEDDIC_FLOW: Record<string, { label: string; detail: string }> = {
  lead: { label: "No MEDDIC yet", detail: "Earn the first meeting. Prep is about them, not us." },
  discovery: { label: "MEDDIC begins — light capture", detail: "Sales starts the first snapshot: Pain (I) populated, Champion candidate (C) identified, Metrics (M) floated. No formal review yet — but the trail starts here." },
  solution_validation: { label: "CP1 — full scored snapshot", detail: "All six letters scored 1-5 with gaps, reviewed by the sales lead, EB in the room — before any POC paper goes out. No exceptions." },
  poc: { label: "CP2 — refresh against POC learnings", detail: "Scores must move: competition surfaced, decision process re-validated, ROI in the EB's currency." },
  negotiation: { label: "CP3 — fresh within 14 days", detail: "A deal may only sit in Commit forecast on a recent review. Stale MEDDIC = Upside." },
  closed_won: { label: "Snapshot archived", detail: "The final MEDDIC becomes the delivery handoff context and the reference baseline." },
};

type Draft = { stages: Stage[]; templates: Template[] };

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "").slice(0, 40) || "item";

export function Process() {
  const save = useMutation(api.blueprint.save);
  const reset = useMutation(api.blueprint.reset);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const stages = draft?.stages ?? STAGES;
  const templates = draft?.templates ?? TEMPLATES;
  const visible = useMemo(() => stages.filter((s) => !s.parking), [stages]);

  const startEdit = () => { setDraft({ stages: clone(STAGES), templates: clone(TEMPLATES) }); setEditing(true); };
  const cancelEdit = () => { setDraft(null); setEditing(false); };
  const saveDraft = async () => {
    if (!draft) return;
    setBusy(true);
    try { await save({ data: draft }); setDraft(null); setEditing(false); } finally { setBusy(false); }
  };
  const resetDefaults = async () => {
    if (!confirm("Reset the blueprint to the built-in defaults? Custom gates and fields are removed (deal records are untouched).")) return;
    setBusy(true);
    try { await reset({}); setDraft(null); setEditing(false); } finally { setBusy(false); }
  };

  const mutateDraft = (fn: (d: Draft) => void) =>
    setDraft((prev) => { const d = clone(prev ?? { stages: clone(STAGES), templates: clone(TEMPLATES) }); fn(d); return d; });

  return (
    <main className="page" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div className="page-head">
        <h2>Process</h2>
        <span className="muted">The whole pipeline, left to right: numbered gates, who files what, and how MEDDIC matures.</span>
        <span style={{ flex: 1 }} />
        {editing ? (
          <>
            <button className="btn quiet" onClick={cancelEdit} disabled={busy}>Cancel</button>
            <button className="btn skip" onClick={resetDefaults} disabled={busy}>Reset to defaults</button>
            <button className="btn primary" onClick={saveDraft} disabled={busy}>{busy ? "Saving…" : "Save blueprint"}</button>
          </>
        ) : (
          <button className="btn" onClick={startEdit}>✎ Edit blueprint</button>
        )}
      </div>

      <div className="proc-flow">
        {visible.map((stage, si) => {
          const stageTemplates = templates.filter((t) => t.id !== "disposition" && t.stages.includes(stage.id));
          const meddic = MEDDIC_FLOW[stage.id];
          return (
            <section className="proc-col" key={stage.id}>
              <header className="proc-head">
                <div className="proc-title">
                  <span className="proc-num">{si + 1}</span>
                  <b>{stage.name}</b>
                  {stage.checkpoint && <span className="pill violet">{stage.checkpoint.id}</span>}
                </div>
                <div className="faint" style={{ fontSize: 11 }}>{stage.probability}% · {stage.forecastCategory}</div>
                <p className="proc-purpose">{stage.purpose}</p>
              </header>

              {meddic && (
                <div className={"proc-meddic" + (stage.id === "lead" ? " none" : "")}>
                  <b>M</b>
                  <div>
                    <div className="proc-meddic-label">{meddic.label}</div>
                    <div className="proc-meddic-detail">{meddic.detail}</div>
                  </div>
                </div>
              )}

              {stageTemplates.length > 0 && (
                <div className="proc-section">
                  <h5>Filed here</h5>
                  {stageTemplates.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      stage={stage}
                      editing={editing}
                      onChange={(fn) => mutateDraft((d) => { const tt = d.templates.find((x) => x.id === t.id); if (tt) fn(tt, d); })}
                    />
                  ))}
                </div>
              )}

              {stage.exitGates.length > 0 && (
                <div className="proc-section">
                  <h5>Exit gates — must be true to advance</h5>
                  <ul className="proc-gates">
                    {stage.exitGates.map((g, gi) => (
                      <GateItem
                        key={g.id}
                        gate={g}
                        code={g.code ?? `${si}.${gi + 1}`}
                        editing={editing}
                        filledBy={templates.find((t) => t.fields.some((f) => f.satisfiesGate === g.id))}
                        onChange={(patch) => mutateDraft((d) => {
                          const st = d.stages.find((x) => x.id === stage.id);
                          const gg = st?.exitGates.find((x) => x.id === g.id);
                          if (gg) Object.assign(gg, patch);
                        })}
                        onDelete={() => mutateDraft((d) => {
                          const st = d.stages.find((x) => x.id === stage.id);
                          if (st) st.exitGates = st.exitGates.filter((x) => x.id !== g.id);
                        })}
                      />
                    ))}
                  </ul>
                  {editing && (
                    <button
                      className="btn tiny skip"
                      onClick={() => {
                        const label = prompt("New gate — what must be true to advance?");
                        if (!label) return;
                        mutateDraft((d) => {
                          const st = d.stages.find((x) => x.id === stage.id);
                          st?.exitGates.push({ id: slug(label), label, type: "check", coach: "" } as Gate);
                        });
                      }}
                    >
                      + Add gate
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <p className="faint" style={{ fontSize: 11.5, marginTop: 10 }}>
        Gate codes (L1, D3, SV5…) are assigned automatically and used everywhere: the staircase, the gate check, the guided interview and the AI reports.
        Saving the blueprint updates the live setup for every user; existing deal records keep their history.
      </p>
    </main>
  );
}

function GateItem({
  gate, code, editing, filledBy, onChange, onDelete,
}: {
  gate: Gate;
  code: string;
  editing: boolean;
  filledBy?: Template;
  onChange: (patch: Partial<Gate>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (editing) {
    return (
      <li className="proc-gate editing">
        <span className="gate-code mono">{code}</span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <input value={gate.label} onChange={(e) => onChange({ label: e.target.value })} />
          <textarea
            rows={2}
            placeholder="Coach text — what success looks like + the pitfall"
            value={gate.coach ?? ""}
            onChange={(e) => onChange({ coach: e.target.value })}
          />
        </div>
        <button className="btn quiet tiny" title="Remove gate" onClick={onDelete}>✕</button>
      </li>
    );
  }
  return (
    <li className="proc-gate" onClick={() => setOpen(!open)}>
      <span className="gate-code mono">{code}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5 }}>{gate.label} {gate.cp && <em className="cp-mini">{gate.cp}</em>}</div>
        {open && gate.coach && <div className="gate-coach" style={{ paddingLeft: 0, marginTop: 3 }}>💡 {gate.coach}</div>}
        {open && filledBy && <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>Filled by: {filledBy.name} ({filledBy.discipline})</div>}
      </div>
      <span className="faint">{open ? "▾" : "▸"}</span>
    </li>
  );
}

function TemplateCard({
  template: t, stage, editing, onChange,
}: {
  template: Template;
  stage: Stage;
  editing: boolean;
  onChange: (fn: (t: Template, d: Draft) => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const gateCodes = stage.exitGates
    .filter((g) => t.fields.some((f) => f.satisfiesGate === g.id))
    .map((g) => g.code)
    .filter(Boolean);
  return (
    <div className="proc-tpl">
      <button className="proc-tpl-head" onClick={() => setOpen(!open)}>
        <b>{t.name}</b>
        <span className="pill blue">{t.discipline}</span>
        <span className="faint mono" style={{ fontSize: 10.5 }}>{t.fields.length} fields</span>
        {gateCodes.length > 0 && <span className="pill green" title="Gates this template satisfies at this stage">⛩ {gateCodes.join(" ")}</span>}
        <span className="faint" style={{ marginLeft: "auto" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ol className="proc-fields">
          {t.fields.map((f, i) => {
            const gate = stage.exitGates.find((g) => g.id === f.satisfiesGate);
            if (editing) {
              return (
                <li key={f.id} className="editing">
                  <span className="mono faint">{i + 1}.</span>
                  <input value={f.label} onChange={(e) => onChange((tt) => { tt.fields[i].label = e.target.value; })} />
                  <select
                    value={f.satisfiesGate ?? ""}
                    title="Gate this field satisfies"
                    onChange={(e) => onChange((tt) => { tt.fields[i].satisfiesGate = e.target.value || undefined; })}
                  >
                    <option value="">no gate</option>
                    {stage.exitGates.map((g) => <option key={g.id} value={g.id}>{g.code} {g.label.slice(0, 30)}</option>)}
                  </select>
                  <button className="btn quiet tiny" onClick={() => onChange((tt) => { tt.fields.splice(i, 1); })}>✕</button>
                </li>
              );
            }
            return (
              <li key={f.id}>
                <span className="mono faint">{i + 1}.</span>
                <span>{(f.group ? f.group + " · " : "") + f.label}</span>
                {gate && <span className="pill green" style={{ marginLeft: 6 }}>⛩ {gate.code}</span>}
              </li>
            );
          })}
          {editing && (
            <li>
              <button
                className="btn tiny skip"
                onClick={() => {
                  const label = prompt("New field label?");
                  if (!label) return;
                  onChange((tt) => {
                    tt.fields.push({ id: slug(label), label, kind: "longtext" } as TemplateField);
                  });
                }}
              >
                + Add field
              </button>
            </li>
          )}
        </ol>
      )}
    </div>
  );
}

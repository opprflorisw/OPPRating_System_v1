import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { STAGE_BY_ID, TEMPLATE_BY_ID, TEMPLATES, MEDDIC_LETTERS, nextStageId } from "../../convex/pipeline";
import { gateProgress, fmtEur, daysBetween, letterScore, meddicPct } from "../../convex/derive";
import type { DealRow } from "../App";

interface Props {
  row: DealRow;
  live: boolean;
  asOf: string;
  onClose: () => void;
  onFileUpdate: (templateId?: string) => void;
  onRequestMove: () => void;
  onDisposition: () => void;
  onOpenClient: () => void;
}

export function RecordCard({ row, live, asOf, onClose, onFileUpdate, onRequestMove, onDisposition, onOpenClient }: Props) {
  const { deal, state } = row;
  const stage = STAGE_BY_ID[state.stageId];
  const progress = gateProgress(stage, state);
  const appendEvent = useMutation(api.deals.appendEvent);
  const [note, setNote] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const next = nextStageId(state.stageId);
  const meddicAge = state.meddic ? daysBetween(state.meddic.at, asOf) : null;
  const pct = state.meddic ? meddicPct(state.meddic.payload) : null;

  // Which template resolves a given gate — for the per-gate "Resolve" button.
  const templateForGate = (gateId: string): string | undefined =>
    TEMPLATES.find((t) => t.stages.includes(state.stageId) && t.fields.some((f) => f.satisfiesGate === gateId))?.id;

  const visibleEvents = deal.events.filter((e) => e.at <= asOf).slice().reverse();

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <header className="drawer-head">
          <div>
            <div className="drawer-account">{deal.account}</div>
            <div className="drawer-site">{deal.site} · {deal.throughput} · {deal.capability}</div>
          </div>
          <div className="drawer-head-actions">
            {live && !stage.terminal && !stage.parking && (
              <div className="menu-wrap">
                <button className="btn quiet" onClick={() => setMenuOpen(!menuOpen)}>···</button>
                {menuOpen && (
                  <div className="menu" onMouseLeave={() => setMenuOpen(false)}>
                    <button onClick={() => { setMenuOpen(false); onOpenClient(); }}>Open MEDDIC history</button>
                    <button onClick={() => { setMenuOpen(false); onFileUpdate("meddic_snapshot"); }}>New MEDDIC snapshot</button>
                    <div className="sep" />
                    <button className="park" onClick={() => { setMenuOpen(false); onDisposition(); }}>⏸ Park (Stagnate)…</button>
                    <button className="lose" onClick={() => { setMenuOpen(false); onDisposition(); }}>✕ Close Lost…</button>
                  </div>
                )}
              </div>
            )}
            <button className="btn quiet" onClick={onClose}>✕</button>
          </div>
        </header>

        <div className="drawer-strip">
          <span className="pill blue">{stage.name}</span>
          <span className="pill outline mono">ACV {fmtEur(deal.acv)}</span>
          {deal.pocFee && <span className="pill outline mono">POC {fmtEur(deal.pocFee)}</span>}
          <span className="pill outline">{stage.probability}% · {state.forecastCategory}</span>
          <span className={"pill " + (state.health === "G" ? "green" : state.health === "A" ? "amber" : "red")}>
            {state.health === "G" ? "healthy" : state.health === "A" ? "watch" : "at risk"}
          </span>
          <span className="pill">{state.daysInStage}d in stage</span>
        </div>

        <p className="drawer-hook">{deal.hook}</p>

        {state.disposition && (
          <div className="panel alert-gray">
            <h4>{state.disposition.kind}</h4>
            <p style={{ margin: "0 0 4px" }}><b>Reason:</b> {state.disposition.reason}</p>
            {state.disposition.detail && <p style={{ margin: "0 0 4px" }}>{state.disposition.detail}</p>}
            {state.disposition.reactivation && <p className="mono" style={{ margin: 0 }}>Reactivation: {state.disposition.reactivation}</p>}
          </div>
        )}

        {state.overrides.filter((o) => !o.resolved).map((o, i) => (
          <div className="panel alert-red" key={i}>
            <h4>⚑ Override flag · {o.at}</h4>
            <p style={{ margin: "0 0 4px" }}>{o.note}</p>
            <p className="mono faint" style={{ margin: 0, fontSize: 11 }}>Still missing: {o.missing.join(", ")}</p>
          </div>
        ))}

        {state.blocker && (
          <div className="panel alert-amber"><h4>Blocker</h4><p style={{ margin: 0 }}>{state.blocker}</p></div>
        )}

        <section className="panel">
          <h4>
            MEDDIC
            {pct !== null && <span className={"score-badge score-" + Math.round((pct / 100) * 5)}>{pct}%</span>}
            {state.meddic ? (
              <span className={"pill " + (meddicAge! > 14 ? "red" : "green")}>reviewed {state.meddic.at} · {meddicAge}d ago</span>
            ) : (
              <span className="pill red">not attached</span>
            )}
            <span style={{ flex: 1 }} />
            <button className="btn quiet tiny" onClick={onOpenClient}>History →</button>
          </h4>
          {state.meddic ? (
            <table className="meddic">
              <tbody>
                {MEDDIC_LETTERS.map((m) => {
                  const p = state.meddic!.payload as Record<string, unknown>;
                  const val = String(p[m.key] ?? "");
                  const score = letterScore(p, m.key);
                  const gap = String(p[`${m.key}_gap`] ?? "");
                  return (
                    <tr key={m.key + m.label}>
                      <td className="letter">{m.letter}</td>
                      <td className="lbl">{m.label}</td>
                      <td>
                        {val || <span className="faint">—</span>}
                        {gap && <div className="gap-note">Gap: {gap}</div>}
                      </td>
                      <td className="score-cell">
                        {score !== null ? <span className={"score-badge score-" + score}>{score}</span> : <span className="faint">–</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="muted" style={{ margin: 0 }}>No snapshot yet. File one — required at CP1, and it is how this deal gets compared over time.</p>
          )}
          {live && !stage.terminal && !stage.parking && (
            <div className="panel-actions">
              <button className="btn" onClick={() => onFileUpdate("meddic_snapshot")}>New snapshot</button>
            </div>
          )}
        </section>

        <section className="panel">
          <h4>
            Exit gates · {stage.name}
            <span className="pill">{progress.done}/{progress.total}</span>
            {stage.checkpoint && <span className="pill violet">{stage.checkpoint.id}</span>}
          </h4>
          {stage.exitGates.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>{stage.purpose}</p>
          ) : (
            <ul className="gates">
              {stage.exitGates.map((g) => {
                const ev = state.gates[g.id];
                const tpl = !ev ? templateForGate(g.id) : undefined;
                return (
                  <li key={g.id} className={ev ? "met" : "unmet"}>
                    <span className="gate-check">{ev ? "✓" : ""}</span>
                    <span className="gate-label">
                      {g.label}
                      {g.cp && <em className="cp-mini">{g.cp}</em>}
                    </span>
                    {ev ? (
                      <span className="gate-ev">{ev.at} · {ev.via}</span>
                    ) : live && tpl ? (
                      <button className="btn tiny gate-resolve" onClick={() => onFileUpdate(tpl)}>
                        Resolve via {TEMPLATE_BY_ID[tpl].name}
                      </button>
                    ) : (
                      <span className="gate-ev faint">open</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {live && !stage.terminal && !stage.parking && (
            <div className="panel-actions">
              <button className="btn primary" onClick={() => onFileUpdate()}>File an update</button>
              {next && (
                <button className="btn" onClick={onRequestMove}>
                  Advance to {STAGE_BY_ID[next].name} →
                </button>
              )}
            </div>
          )}
        </section>

        <section className="panel">
          <h4>Record · {state.eventCount} entries</h4>
          {live && (
            <div className="note-row">
              <input
                value={note}
                placeholder="Quick note on the record… (Enter to file)"
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && note.trim()) {
                    await appendEvent({
                      dealId: deal._id as never,
                      at: asOf, author: "Floris", discipline: "Sales", type: "note", note: note.trim(),
                    });
                    setNote("");
                  }
                }}
              />
            </div>
          )}
          <ol className="timeline">
            {visibleEvents.map((e) => (
              <li key={e._id} className={e.type + (e.override ? " ovr" : "")}>
                <div className="tl-head">
                  <span className="mono">{e.at}</span>
                  <span className="tl-type">
                    {e.type === "template" ? TEMPLATE_BY_ID[e.templateId ?? ""]?.name ?? e.templateId : e.type.toUpperCase()}
                  </span>
                  <span className="avatar">{initials(e.author)}</span>
                  <span>{e.author} · {e.discipline}</span>
                </div>
                {e.type === "stage" && (
                  <div className="tl-body">
                    {STAGE_BY_ID[e.from ?? ""]?.name ?? e.from} → <b>{STAGE_BY_ID[e.to ?? ""]?.name ?? e.to}</b>
                    {e.override && <span className="pill red" style={{ marginLeft: 7 }}>⚑ override</span>}
                  </div>
                )}
                {e.note && <div className="tl-note">{e.note}</div>}
                {e.payload && <PayloadView payload={e.payload as Record<string, unknown>} />}
                {e.attachments && e.attachments.length > 0 && (
                  <div className="tl-att">📎 {e.attachments.map((a) => a.name).join(", ")}</div>
                )}
                {e.gatesSatisfied && e.gatesSatisfied.length > 0 && (
                  <div className="tl-gates">✓ gates: {e.gatesSatisfied.join(", ")}</div>
                )}
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </>
  );
}

export function initials(name: string): string {
  return name.replace(/\(.*\)/, "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function PayloadView({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(([, v]) => v !== "" && v !== undefined && v !== null);
  if (entries.length === 0) return null;
  const shown = entries.slice(0, 8);
  return (
    <dl className="payload">
      {shown.map(([k, v]) => (
        <div key={k} className="payload-row">
          <dt>{k.replace(/_/g, " ")}</dt>
          <dd>{typeof v === "boolean" ? (v ? "yes" : "no") : String(v)}</dd>
        </div>
      ))}
      {entries.length > shown.length && <div className="payload-row"><dt className="faint">+ {entries.length - shown.length} more fields</dt><dd /></div>}
    </dl>
  );
}

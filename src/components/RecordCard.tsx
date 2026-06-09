import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { STAGE_BY_ID, TEMPLATE_BY_ID, nextStageId } from "../../convex/pipeline";
import { gateProgress, fmtEur, daysBetween } from "../../convex/derive";
import type { DealRow } from "../App";

interface Props {
  row: DealRow;
  live: boolean;
  asOf: string;
  onClose: () => void;
  onFileUpdate: () => void;
  onRequestMove: () => void;
}

const MEDDIC_KEYS: { key: string; letter: string; label: string }[] = [
  { key: "metrics", letter: "M", label: "Metrics / € case" },
  { key: "eb", letter: "E", label: "Economic Buyer" },
  { key: "criteria", letter: "D", label: "Decision criteria" },
  { key: "process", letter: "D", label: "Decision process" },
  { key: "pain", letter: "I", label: "Identified pain" },
  { key: "champion", letter: "C", label: "Champion" },
];

export function RecordCard({ row, live, asOf, onClose, onFileUpdate, onRequestMove }: Props) {
  const { deal, state } = row;
  const stage = STAGE_BY_ID[state.stageId];
  const progress = gateProgress(stage, state);
  const appendEvent = useMutation(api.deals.appendEvent);
  const [note, setNote] = useState("");
  const next = nextStageId(state.stageId);
  const meddicAge = state.meddic ? daysBetween(state.meddic.at, asOf) : null;

  const visibleEvents = deal.events
    .filter((e) => e.at <= asOf)
    .slice()
    .reverse();

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <header className="drawer-head">
          <div>
            <div className="drawer-account">{deal.account}</div>
            <div className="drawer-site">{deal.site} · {deal.throughput} · {deal.capability}</div>
          </div>
          <button className="btn tiny ghost" onClick={onClose}>CLOSE ✕</button>
        </header>

        <div className="drawer-strip mono">
          <span>{stage.name}</span>
          <span>ACV {fmtEur(deal.acv)}</span>
          {deal.pocFee && <span>POC {fmtEur(deal.pocFee)}</span>}
          <span>{stage.probability}% · {state.forecastCategory}</span>
          <span className={"dot-inline " + state.health}>{state.health}</span>
        </div>

        <p className="drawer-hook">{deal.hook}</p>

        {state.disposition && (
          <div className="panel disp">
            <h4>{state.disposition.kind}</h4>
            <p><b>Reason:</b> {state.disposition.reason}</p>
            {state.disposition.detail && <p>{state.disposition.detail}</p>}
            {state.disposition.reactivation && <p className="mono">Reactivation: {state.disposition.reactivation}</p>}
          </div>
        )}

        {state.overrides.filter((o) => !o.resolved).map((o, i) => (
          <div className="panel override" key={i}>
            <h4>⚑ OVERRIDE FLAG · {o.at}</h4>
            <p>{o.note}</p>
            <p className="mono">Still missing: {o.missing.join(", ")}</p>
          </div>
        ))}

        {state.blocker && (
          <div className="panel blockerp"><h4>⛔ Blocker</h4><p>{state.blocker}</p></div>
        )}

        <section className="panel">
          <h4>
            MEDDIC spine
            {state.meddic ? (
              <span className={"mono tag " + (meddicAge! > 14 ? "stale" : "fresh")}>
                reviewed {state.meddic.at} ({meddicAge}d ago)
              </span>
            ) : (
              <span className="mono tag stale">not attached</span>
            )}
          </h4>
          {state.meddic ? (
            <table className="meddic">
              <tbody>
                {MEDDIC_KEYS.map((m) => {
                  const val = String((state.meddic!.payload as Record<string, unknown>)[m.key] ?? "");
                  const gap = !val || /not engaged|to map|tbd|unknown/i.test(val);
                  return (
                    <tr key={m.key + m.label} className={gap ? "gap" : ""}>
                      <td className="letter">{m.letter}</td>
                      <td className="lbl">{m.label}</td>
                      <td>{val || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="muted">File a MEDDIC snapshot to attach the qualification spine (required at CP1).</p>
          )}
        </section>

        <section className="panel">
          <h4>
            Exit gates · {stage.name}
            <span className="mono tag">{progress.done}/{progress.total}</span>
            {stage.checkpoint && <span className="cp-badge">{stage.checkpoint.id}</span>}
          </h4>
          {stage.exitGates.length === 0 ? (
            <p className="muted">{stage.purpose}</p>
          ) : (
            <ul className="gates">
              {stage.exitGates.map((g) => {
                const ev = state.gates[g.id];
                return (
                  <li key={g.id} className={ev ? "met" : "unmet"}>
                    <span className="gate-mark">{ev ? "■" : "□"}</span>
                    <span className="gate-label">
                      {g.label}
                      {g.cp && <em className="cp-mini"> {g.cp}</em>}
                    </span>
                    {ev && <span className="gate-ev mono">{ev.at} · {ev.via}</span>}
                  </li>
                );
              })}
            </ul>
          )}
          {live && !stage.terminal && !stage.parking && (
            <div className="panel-actions">
              <button className="btn" onClick={onFileUpdate}>File an update</button>
              {next && (
                <button className="btn on" onClick={onRequestMove}>
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
                placeholder="Quick note on the record…"
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
              <li key={e._id} className={"tl " + e.type + (e.override ? " ovr" : "")}>
                <div className="tl-head mono">
                  <span className="tl-date">{e.at}</span>
                  <span className="tl-type">
                    {e.type === "template" ? TEMPLATE_BY_ID[e.templateId ?? ""]?.name ?? e.templateId : e.type.toUpperCase()}
                  </span>
                  <span className="tl-author">{e.author} · {e.discipline}</span>
                </div>
                {e.type === "stage" && (
                  <div className="tl-body">
                    {STAGE_BY_ID[e.from ?? ""]?.name ?? e.from} → <b>{STAGE_BY_ID[e.to ?? ""]?.name ?? e.to}</b>
                    {e.override && <span className="flag"> ⚑ override</span>}
                  </div>
                )}
                {e.note && <div className="tl-note">{e.note}</div>}
                {e.payload && <PayloadView payload={e.payload as Record<string, unknown>} />}
                {e.gatesSatisfied && e.gatesSatisfied.length > 0 && (
                  <div className="tl-gates mono">✓ gates: {e.gatesSatisfied.join(", ")}</div>
                )}
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </>
  );
}

function PayloadView({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(([, v]) => v !== "" && v !== undefined && v !== null);
  if (entries.length === 0) return null;
  return (
    <dl className="payload">
      {entries.map(([k, v]) => (
        <div key={k} className="payload-row">
          <dt>{k.replace(/_/g, " ")}</dt>
          <dd>{typeof v === "boolean" ? (v ? "yes" : "no") : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

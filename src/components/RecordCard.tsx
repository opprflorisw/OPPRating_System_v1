import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  BOARD_STAGES, STAGE_BY_ID, TEMPLATE_BY_ID, TEMPLATES, MEDDIC_LETTERS, nextStageId,
} from "../../convex/pipeline";
import {
  gateProgress, fmtEur, daysBetween, letterScore, meddicPct,
  gateLedger, gateDrift, stageHistory, eventFieldChanges,
  type GateEntry,
} from "../../convex/derive";
import type { DealRow } from "../App";
import type { StoredEvent } from "../types";

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

type Tab = "overview" | "gates" | "activity" | "meddic";

export function RecordCard(props: Props) {
  const { row, live, asOf, onClose, onFileUpdate, onRequestMove, onDisposition, onOpenClient } = props;
  const { deal, state } = row;
  const stage = STAGE_BY_ID[state.stageId];
  const [tab, setTab] = useState<Tab>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const next = nextStageId(state.stageId);
  const appendEvent = useMutation(api.deals.appendEvent);

  // Where a parked deal would return to: the stage it paused from.
  const pausedFrom = stage.parking
    ? deal.events.filter((e) => e.type === "stage" && e.to === state.stageId).slice(-1)[0]?.from ?? "lead"
    : null;

  const reactivate = async () => {
    if (!pausedFrom) return;
    setReactivating(true);
    try {
      await appendEvent({
        dealId: deal._id as never,
        at: asOf, author: "Floris", discipline: "Sales", type: "stage",
        from: state.stageId, to: pausedFrom,
        note: `Reactivated from ${stage.name} back to ${STAGE_BY_ID[pausedFrom]?.name ?? pausedFrom}.`,
      });
    } finally {
      setReactivating(false);
    }
  };

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
            {live && stage.parking && pausedFrom && (
              <button className="btn" onClick={reactivate} disabled={reactivating}>
                {reactivating ? "Reactivating…" : `▶ Reactivate to ${STAGE_BY_ID[pausedFrom]?.name ?? pausedFrom}`}
              </button>
            )}
            {live && !stage.terminal && !stage.parking && (
              <>
                <button className="btn primary" onClick={() => onFileUpdate()}>File an update</button>
                <div className="menu-wrap">
                  <button className="btn quiet" onClick={() => setMenuOpen(!menuOpen)}>···</button>
                  {menuOpen && (
                    <div className="menu" onMouseLeave={() => setMenuOpen(false)}>
                      {next && <button onClick={() => { setMenuOpen(false); onRequestMove(); }}>Advance to {STAGE_BY_ID[next].name} →</button>}
                      <button onClick={() => { setMenuOpen(false); onFileUpdate("meddic_snapshot"); }}>New MEDDIC snapshot</button>
                      <button onClick={() => { setMenuOpen(false); onOpenClient(); }}>Open MEDDIC history</button>
                      <div className="sep" />
                      <button className="park" onClick={() => { setMenuOpen(false); onDisposition(); }}>⏸ Park (Stagnate)…</button>
                      <button className="lose" onClick={() => { setMenuOpen(false); onDisposition(); }}>✕ Close Lost…</button>
                    </div>
                  )}
                </div>
              </>
            )}
            <button className="btn quiet" onClick={onClose}>✕</button>
          </div>
        </header>

        <div className="drawer-tabs">
          {(
            [
              ["overview", "Overview"],
              ["gates", "Gates"],
              ["activity", `Activity · ${state.eventCount}`],
              ["meddic", "MEDDIC"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} className={"drawer-tab" + (tab === id ? " active" : "")} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab {...props} />}
        {tab === "gates" && <GatesTab {...props} />}
        {tab === "activity" && <ActivityTab {...props} />}
        {tab === "meddic" && <MeddicTab {...props} />}
      </aside>
    </>
  );
}

/* ── Overview ─────────────────────────────────────────────────────────── */

function OverviewTab({ row, asOf }: Props) {
  const { deal, state } = row;
  const stage = STAGE_BY_ID[state.stageId];
  const progress = gateProgress(stage, state);
  const nextStep = state.meddic ? String(state.meddic.payload["next_step"] ?? "") : "";

  return (
    <div>
      <div className="drawer-strip">
        <span className="pill blue">{stage.name}</span>
        <span className="pill outline mono">ACV {fmtEur(deal.acv)}</span>
        {deal.pocFee && <span className="pill outline mono">POC {fmtEur(deal.pocFee)}</span>}
        <span className="pill outline">{stage.probability}% · {state.forecastCategory}</span>
        <span className={"pill " + (state.health === "G" ? "green" : state.health === "A" ? "amber" : "red")}>
          {state.health === "G" ? "healthy" : state.health === "A" ? "watch" : "at risk"}
        </span>
        <span className="pill">{state.daysInStage}d in stage</span>
        {!stage.terminal && !stage.parking && <span className="pill">{progress.done}/{progress.total} gates</span>}
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

      {nextStep && (
        <div className="panel"><h4>Next step</h4><p style={{ margin: 0 }}>{nextStep}</p></div>
      )}

      <div className="panel">
        <h4>Account facts</h4>
        <dl className="payload">
          <div className="payload-row"><dt>Region</dt><dd>{deal.region}</dd></div>
          <div className="payload-row"><dt>Throughput</dt><dd>{deal.throughput}</dd></div>
          <div className="payload-row"><dt>Capability</dt><dd>{deal.capability}</dd></div>
          <div className="payload-row"><dt>Owner</dt><dd>{deal.owner}</dd></div>
          <div className="payload-row"><dt>Last touch</dt><dd>{state.lastEventAt} ({state.daysSinceTouch}d ago, as of {asOf})</dd></div>
        </dl>
      </div>
    </div>
  );
}

/* ── Gates — the staircase ────────────────────────────────────────────── */

function GatesTab({ row, asOf, live, onFileUpdate }: Props) {
  const { deal, state } = row;
  const ledger = useMemo(() => gateLedger(deal.events, asOf), [deal.events, asOf]);
  const visits = useMemo(() => stageHistory(deal.events, asOf), [deal.events, asOf]);
  const isParked = STAGE_BY_ID[state.stageId].parking;
  // For parked deals the staircase highlights where the deal paused.
  const effectiveStageId = isParked ? visits.filter((v) => !STAGE_BY_ID[v.stageId].parking).slice(-1)[0]?.stageId ?? "lead" : state.stageId;
  const currentOrder = STAGE_BY_ID[effectiveStageId].order;
  const [openStages, setOpenStages] = useState<Set<string>>(new Set([effectiveStageId]));

  const toggle = (id: string) =>
    setOpenStages((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const templateForGate = (gateId: string, stageId: string): string | undefined =>
    TEMPLATES.find((t) => t.stages.includes(stageId) && t.fields.some((f) => f.satisfiesGate === gateId))?.id;

  return (
    <div className="stair">
      {isParked && (
        <p className="muted" style={{ fontSize: 12 }}>
          Deal is {state.disposition?.kind ?? "parked"} — the staircase shows where it paused.
        </p>
      )}
      {BOARD_STAGES.map((stage) => {
        const status = stage.order < currentOrder ? "past" : stage.order === currentOrder ? "current" : "future";
        const visit = visits.filter((v) => v.stageId === stage.id).slice(-1)[0];
        const done = stage.exitGates.filter((g) => state.gates[g.id]).length;
        const open = openStages.has(stage.id);
        return (
          <section key={stage.id} className={"stair-stage " + status}>
            <button className="stair-head" onClick={() => toggle(stage.id)}>
              <span className={"stair-dot " + status}>{status === "past" ? "✓" : ""}</span>
              <span className="stair-name">{stage.name}</span>
              {stage.checkpoint && <span className="pill violet">{stage.checkpoint.id}</span>}
              <span style={{ flex: 1 }} />
              {status === "past" && visit && <span className="faint mono" style={{ fontSize: 11 }}>{visit.enteredAt} → {visit.exitedAt}</span>}
              {status === "current" && stage.exitGates.length > 0 && <span className="pill blue">{done}/{stage.exitGates.length} gates</span>}
              {status === "future" && <span className="faint" style={{ fontSize: 11 }}>{stage.exitGates.length > 0 ? `${stage.exitGates.length} gates ahead` : ""}</span>}
              <span className="faint">{open ? "▾" : "▸"}</span>
            </button>
            {open && (
              <div className="stair-body">
                {stage.exitGates.length === 0 ? (
                  <p className="muted" style={{ fontSize: 12, margin: "4px 0" }}>{stage.purpose}</p>
                ) : (
                  <ul className="gates">
                    {stage.exitGates.map((g) => (
                      <GateRow
                        key={g.id}
                        gate={g}
                        entries={ledger[g.id]}
                        met={Boolean(state.gates[g.id])}
                        live={live && status === "current"}
                        resolveTemplate={templateForGate(g.id, stage.id)}
                        onResolve={onFileUpdate}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function GateRow({
  gate, entries, met, live, resolveTemplate, onResolve,
}: {
  gate: { id: string; label: string; cp?: string };
  entries: GateEntry[] | undefined;
  met: boolean;
  live: boolean;
  resolveTemplate?: string;
  onResolve: (templateId?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const drift = gateDrift(entries);
  const last = entries?.[entries.length - 1];

  return (
    <li className={met ? "met" : "unmet"} style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
      <button className="gate-row-btn" onClick={() => setOpen(!open)}>
        <span className="gate-check">{met ? "✓" : ""}</span>
        <span className="gate-label">
          {gate.label}
          {gate.cp && <em className="cp-mini">{gate.cp}</em>}
        </span>
        {drift && <span className="pill amber" title={`Was: ${drift.from}`}>↻ changed</span>}
        {last ? (
          <span className="gate-ev">{last.at}</span>
        ) : live && resolveTemplate ? (
          <span
            className="btn tiny gate-resolve"
            role="button"
            onClick={(e) => { e.stopPropagation(); onResolve(resolveTemplate); }}
          >
            Resolve via {TEMPLATE_BY_ID[resolveTemplate].name}
          </span>
        ) : (
          <span className="gate-ev faint">open</span>
        )}
        <span className="faint">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="gate-detail">
          {!entries || entries.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Nothing filed for this gate yet{live && resolveTemplate ? ` — file a ${TEMPLATE_BY_ID[resolveTemplate].name}.` : "."}
            </p>
          ) : (
            <>
              {drift && (
                <div className="drift-note">
                  ↻ Value changed since the gate passed: <s>{truncate(drift.from, 60)}</s> → <b>{truncate(drift.to, 60)}</b>
                </div>
              )}
              <ol className="ledger">
                {entries.slice().reverse().map((en, i) => (
                  <li key={i}>
                    <div className="ledger-head">
                      <span className={"pill " + (en.kind === "passed" ? "green" : en.kind === "updated" ? "amber" : "outline")}>
                        {en.kind === "passed" ? "✓ passed" : en.kind === "updated" ? "↻ updated" : "reaffirmed"}
                      </span>
                      <span className="mono faint" style={{ fontSize: 11 }}>{en.at}</span>
                      <span className="avatar">{initials(en.author)}</span>
                      <span style={{ fontSize: 12 }}>{en.author}</span>
                      {en.templateId && <span className="faint" style={{ fontSize: 11 }}>via {TEMPLATE_BY_ID[en.templateId]?.name ?? en.templateId}</span>}
                      {en.prov && en.prov.kind !== "manual" && <span className="pill violet">✦ AI{en.prov.kind === "ai-edited" ? " · edited" : ""}</span>}
                      {en.hasEvidence && <span className="pill outline">📎 evidence</span>}
                    </div>
                    <div className="ledger-value">{en.value}</div>
                    {en.prov?.quote && <div className="prop-quote">“{en.prov.quote}”</div>}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </li>
  );
}

/* ── Activity — the condensed feed ────────────────────────────────────── */

function ActivityTab({ row, asOf, live }: Props) {
  const { deal } = row;
  const appendEvent = useMutation(api.deals.appendEvent);
  const [note, setNote] = useState("");
  const [openIdx, setOpenIdx] = useState<string | null>(null);
  const visible = deal.events.filter((e) => e.at <= asOf).slice().reverse();

  return (
    <div>
      {live && (
        <div className="note-row" style={{ marginTop: 12 }}>
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
      <div className="act-list">
        {visible.map((e) => (
          <ActivityRow
            key={e._id}
            event={e}
            allEvents={deal.events}
            open={openIdx === e._id}
            onToggle={() => setOpenIdx(openIdx === e._id ? null : e._id)}
          />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({
  event: e, allEvents, open, onToggle,
}: {
  event: StoredEvent;
  allEvents: StoredEvent[];
  open: boolean;
  onToggle: () => void;
}) {
  const changes = useMemo(() => eventFieldChanges(allEvents, e), [allEvents, e]);
  const gatesPassed = e.gatesSatisfied?.length ?? 0;
  const gatesUpdated = changes.filter(
    (c) => c.satisfiesGate && c.oldValue !== null && !(e.gatesSatisfied ?? []).includes(c.satisfiesGate)
  ).length;
  const audio = (e.attachments ?? []).filter((a) => a.mime.startsWith("audio/") || a.mime.startsWith("video/"));
  const files = (e.attachments ?? []).filter((a) => !a.mime.startsWith("audio/") && !a.mime.startsWith("video/"));

  const title =
    e.type === "template"
      ? `filed ${TEMPLATE_BY_ID[e.templateId ?? ""]?.name ?? e.templateId}`
      : e.type === "stage"
        ? `moved ${STAGE_BY_ID[e.from ?? ""]?.name ?? e.from} → ${STAGE_BY_ID[e.to ?? ""]?.name ?? e.to}`
        : e.type === "note"
          ? "added a note"
          : e.type;

  return (
    <div className={"act-row" + (e.override ? " ovr" : "")}>
      <button className="act-head" onClick={onToggle}>
        <span className="avatar">{initials(e.author)}</span>
        <span className="act-title"><b>{e.author}</b> {title}</span>
        <span className="act-chips">
          {e.override && <span className="pill red">⚑</span>}
          {e.evidenceText && <span className="pill outline">📝</span>}
          {audio.length > 0 && <span className="pill outline">🎙 {audio.length}</span>}
          {files.length > 0 && <span className="pill outline">📎 {files.length}</span>}
          {gatesPassed > 0 && <span className="pill green">✓ {gatesPassed} gate{gatesPassed > 1 ? "s" : ""}</span>}
          {gatesUpdated > 0 && <span className="pill amber">↻ {gatesUpdated}</span>}
        </span>
        <span className="mono faint" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{e.at}</span>
        <span className="faint">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="act-detail">
          {e.note && <p className="tl-note" style={{ margin: "0 0 8px" }}>{e.note}</p>}

          {(e.evidenceText || (e.attachments && e.attachments.length > 0)) && (
            <div className="evidence-view">
              <div className="group-head" style={{ margin: "0 0 6px" }}>Root evidence</div>
              {e.evidenceText && <blockquote className="evidence-quote">{e.evidenceText}</blockquote>}
              {audio.map((a, i) => (
                <div key={i} style={{ margin: "6px 0" }}>
                  <span className="pill violet" style={{ marginBottom: 4 }}>🎙 {a.name}</span>
                  {a.url && <audio controls src={a.url} style={{ width: "100%", height: 32 }} />}
                </div>
              ))}
              {files.map((a, i) => (
                <div key={i} style={{ margin: "4px 0" }}>
                  {a.url
                    ? <a href={a.url} target="_blank" rel="noreferrer" className="pill outline">📎 {a.name} ↗</a>
                    : <span className="pill outline">📎 {a.name}</span>}
                </div>
              ))}
            </div>
          )}

          {changes.length > 0 && (
            <>
              <div className="group-head" style={{ margin: "10px 0 6px" }}>What this changed</div>
              <table className="diff-table">
                <tbody>
                  {changes.map((c) => (
                    <tr key={c.fieldId}>
                      <td className="diff-label">
                        {c.label}
                        {c.satisfiesGate && <span className="cp-mini" style={{ display: "block" }}>⛩ {c.satisfiesGate}</span>}
                      </td>
                      <td className="diff-vals">
                        {c.oldValue !== null && <s className="diff-old">{truncate(c.oldValue, 90)}</s>}
                        <span className="diff-new">{c.newValue}</span>
                        {c.prov && c.prov.kind !== "manual" && <span className="pill violet" style={{ marginLeft: 6 }}>✦ AI</span>}
                        {c.prov?.quote && <div className="prop-quote">“{c.prov.quote}”</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {e.gatesSatisfied && e.gatesSatisfied.length > 0 && (
            <div className="tl-gates" style={{ marginTop: 8 }}>✓ gates: {e.gatesSatisfied.join(", ")}</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── MEDDIC tab ───────────────────────────────────────────────────────── */

function MeddicTab({ row, asOf, live, onFileUpdate, onOpenClient }: Props) {
  const { state } = row;
  const stage = STAGE_BY_ID[state.stageId];
  const meddicAge = state.meddic ? daysBetween(state.meddic.at, asOf) : null;
  const pct = state.meddic ? meddicPct(state.meddic.payload) : null;

  return (
    <div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h4>
          Latest snapshot
          {pct !== null && <span className={"score-badge score-" + Math.round((pct / 100) * 5)}>{pct}%</span>}
          {state.meddic ? (
            <span className={"pill " + (meddicAge! > 14 ? "red" : "green")}>reviewed {state.meddic.at} · {meddicAge}d ago</span>
          ) : (
            <span className="pill red">not attached</span>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn quiet tiny" onClick={onOpenClient}>Full history →</button>
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
          <p className="muted" style={{ margin: 0 }}>No snapshot yet. Required at CP1 — and it is how this deal becomes comparable over time.</p>
        )}
        {live && !stage.terminal && !stage.parking && (
          <div className="panel-actions">
            <button className="btn primary" onClick={() => onFileUpdate("meddic_snapshot")}>New snapshot</button>
          </div>
        )}
      </div>
      {state.meddic && String(state.meddic.payload["verdict"] ?? "") && (
        <div className="panel alert-gray">
          <h4>Verdict</h4>
          <p style={{ margin: 0, fontStyle: "italic" }}>{String(state.meddic.payload["verdict"])}</p>
        </div>
      )}
    </div>
  );
}

/* ── shared ───────────────────────────────────────────────────────────── */

export function initials(name: string): string {
  return name.replace(/\(.*\)/, "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

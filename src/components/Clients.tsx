import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { STAGE_BY_ID, MEDDIC_LETTERS } from "../../convex/pipeline";
import { fmtEur, meddicHistory, meddicPct, letterScore } from "../../convex/derive";
import { initials } from "./RecordCard";
import type { DealRow } from "../App";

interface Props {
  rows: DealRow[];
  asOf: string;
  workspace: string;
  clientSlug: string | null;
  live: boolean;
  onOpenClient: (slug: string | null) => void;
  onOpenDeal: (dealId: string) => void;
  onNewSnapshot: (row: DealRow) => void;
}

export function Clients(props: Props) {
  const { rows, clientSlug } = props;
  const row = rows.find((r) => r.deal.slug === clientSlug) ?? null;
  return row ? <ClientDetail {...props} row={row} /> : <ClientList {...props} />;
}

function ClientList({ rows, asOf, onOpenClient }: Props) {
  const sorted = rows.slice().sort((a, b) => {
    const sa = STAGE_BY_ID[a.state.stageId].order;
    const sb = STAGE_BY_ID[b.state.stageId].order;
    return sa === sb ? b.deal.acv - a.deal.acv : sb - sa;
  });
  return (
    <main className="page">
      <div className="page-head">
        <h2>Clients</h2>
        <span className="muted">MEDDIC is the snapshot spine — open a client to see how the deal architecture moved over time.</span>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Account</th><th>Stage</th><th>ACV</th><th>MEDDIC</th><th>Trend</th><th>Last reviewed</th><th>Open gap</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const history = meddicHistory(r.deal.events, asOf);
            const latest = history[history.length - 1];
            const pct = latest ? meddicPct(latest.payload) : null;
            const prev = history[history.length - 2];
            const prevPct = prev ? meddicPct(prev.payload) : null;
            const trend = pct !== null && prevPct !== null ? pct - prevPct : null;
            const weakest = latest ? weakestLetter(latest.payload) : null;
            return (
              <tr key={r.deal._id} className="click" onClick={() => onOpenClient(r.deal.slug)}>
                <td><b>{r.deal.account}</b> <span className="faint">{r.deal.site}</span></td>
                <td><span className="pill blue">{STAGE_BY_ID[r.state.stageId].name}</span></td>
                <td className="mono">{fmtEur(r.deal.acv)}</td>
                <td>{pct !== null ? <span className={"score-badge score-" + Math.round((pct / 100) * 5)}>{pct}%</span> : <span className="faint">no snapshot</span>}</td>
                <td>
                  {trend === null ? <span className="faint">–</span> : trend > 0 ? <span className="delta-up">▲ +{trend}</span> : trend < 0 ? <span className="delta-down">▼ {trend}</span> : <span className="delta-flat">flat</span>}
                </td>
                <td className="mono" style={{ fontSize: 11 }}>{latest?.at ?? "—"}</td>
                <td style={{ fontSize: 12 }}>{weakest ? <span><b className="mono">{weakest.letter}</b> · {weakest.gap || weakest.label}</span> : <span className="faint">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}

function ClientDetail({ row, rows, asOf, workspace, live, onOpenClient, onOpenDeal, onNewSnapshot }: Props & { row: DealRow }) {
  const askAi = useAction(api.chat.ask);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { deal, state } = row;
  const history = meddicHistory(deal.events, asOf);
  const stage = STAGE_BY_ID[state.stageId];

  return (
    <main className="page">
      <div className="page-head">
        <button className="btn quiet" onClick={() => onOpenClient(null)}>← Clients</button>
        <h2>{deal.account} <span className="muted" style={{ fontWeight: 400 }}>{deal.site}</span></h2>
        <span className="pill blue">{stage.name}</span>
        <span className="pill outline mono">ACV {fmtEur(deal.acv)}</span>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => onOpenDeal(deal._id)}>Open deal record</button>
        {live && !stage.terminal && !stage.parking && (
          <button className="btn primary" onClick={() => onNewSnapshot(row)}>New MEDDIC snapshot</button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            No MEDDIC snapshots yet. The snapshot is how this deal becomes comparable over time — file the first one from the deal record (required at CP1).
          </p>
        </div>
      ) : (
        <>
          <div className="panel">
            <h4>Score over time <span className="pill">{history.length} snapshots</span></h4>
            <div className="sparkline">
              {history.map((s, i) => {
                const pct = meddicPct(s.payload) ?? 0;
                return (
                  <div key={i} className="spark-bar" style={{ height: Math.max(4, (pct / 100) * 34) }} title={`${s.at}: ${pct}%`}>
                    <span>{pct}</span>
                  </div>
                );
              })}
            </div>
            <p className="faint" style={{ margin: "14px 0 0", fontSize: 11 }}>
              {history[0].at} → {history[history.length - 1].at}. A flat line is a finding: the deal is moving without the architecture improving.
            </p>
          </div>

          <div className="matrix-wrap" style={{ margin: "12px 0" }}>
            <table className="matrix">
              <thead>
                <tr>
                  <th></th>
                  {history.map((s, i) => (
                    <th key={i}>
                      {s.at}
                      <div style={{ marginTop: 3, display: "flex", gap: 5, alignItems: "center" }}>
                        <span className="avatar" title={s.author}>{initials(s.author)}</span>
                        {(() => { const p = meddicPct(s.payload); return p !== null ? <span className={"score-badge score-" + Math.round((p / 100) * 5)}>{p}%</span> : null; })()}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEDDIC_LETTERS.map((m) => (
                  <tr key={m.key + m.label}>
                    <td className="letter-cell">{m.letter} <small>{m.label}</small></td>
                    {history.map((s, i) => {
                      const score = letterScore(s.payload, m.key);
                      const prevScore = i > 0 ? letterScore(history[i - 1].payload, m.key) : null;
                      const delta = score !== null && prevScore !== null ? score - prevScore : null;
                      const gap = String(s.payload[`${m.key}_gap`] ?? "");
                      return (
                        <td key={i}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
                            {score !== null ? <span className={"score-badge score-" + score}>{score}</span> : <span className="faint">–</span>}
                            {delta !== null && delta !== 0 && (
                              <span className={delta > 0 ? "delta-up" : "delta-down"}>{delta > 0 ? `▲ +${delta}` : `▼ ${delta}`}</span>
                            )}
                            {delta === 0 && <span className="delta-flat">=</span>}
                          </div>
                          <div className="cell-state">{String(s.payload[m.key] ?? "")}</div>
                          {gap && <div className="gap-note" style={{ fontSize: 11 }}>Gap: {gap}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="letter-cell">Verdict</td>
                  {history.map((s, i) => (
                    <td key={i} className="cell-state" style={{ fontStyle: "italic" }}>{String(s.payload["verdict"] ?? "—")}</td>
                  ))}
                </tr>
                <tr>
                  <td className="letter-cell">Blocker</td>
                  {history.map((s, i) => {
                    const b = String(s.payload["blocker"] ?? "");
                    return <td key={i}>{b ? <span className="pill amber">{b}</span> : <span className="faint">—</span>}</td>;
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="panel">
            <h4>
              AI read on this history
              <span style={{ flex: 1 }} />
              <button
                className="btn ai tiny"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setAnalysis(null);
                  try {
                    setAnalysis(
                      await askAi({
                        asOf,
                        workspace,
                        question:
                          `Analyse the MEDDIC snapshot history for ${deal.account} (${deal.site}). ` +
                          `What improved, what is structurally stuck (letters flat or low across snapshots), what is the single highest-leverage gap to fix now, and what does the trajectory say about whether this deal will close by its target? Use the scores and gaps in the data. Short, direct, no filler.`,
                      })
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Analysing…" : "✦ Analyse trajectory"}
              </button>
            </h4>
            {analysis ? <pre className="report">{analysis}</pre> : (
              <p className="muted" style={{ margin: 0 }}>What improved, what's structurally stuck, the highest-leverage gap. Uses every snapshot above.</p>
            )}
          </div>
        </>
      )}

      <div className="panel">
        <h4>Other deals at this account</h4>
        {rows.filter((r) => r.deal.account === deal.account && r.deal._id !== deal._id).length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>None.</p>
        ) : (
          rows
            .filter((r) => r.deal.account === deal.account && r.deal._id !== deal._id)
            .map((r) => (
              <button key={r.deal._id} className="btn quiet" onClick={() => onOpenClient(r.deal.slug)}>
                {r.deal.site} — {STAGE_BY_ID[r.state.stageId].name} · {fmtEur(r.deal.acv)} →
              </button>
            ))
        )}
      </div>
    </main>
  );
}

function weakestLetter(payload: Record<string, unknown>): { letter: string; label: string; gap: string } | null {
  let worst: { letter: string; label: string; gap: string; score: number } | null = null;
  for (const m of MEDDIC_LETTERS) {
    const s = letterScore(payload, m.key);
    if (s !== null && (worst === null || s < worst.score)) {
      worst = { letter: m.letter, label: m.label, gap: String(payload[`${m.key}_gap`] ?? ""), score: s };
    }
  }
  return worst;
}

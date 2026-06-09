import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { STAGE_BY_ID, MEDDIC_LETTERS } from "../../convex/pipeline";
import { fmtEur, meddicHistory, meddicPct, letterScore } from "../../convex/derive";
import { initials } from "./RecordCard";
import { Md, CopyButton, PrintButton } from "./Markdown";
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
  const accountDeals = rows.filter((r) => r.deal.account === deal.account);

  return (
    <main className="page">
      <div className="page-head">
        <button className="btn quiet" onClick={() => onOpenClient(null)}>← Clients</button>
        <h2>{deal.account}</h2>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => onOpenDeal(deal._id)}>Open deal record</button>
        {live && !stage.terminal && !stage.parking && (
          <button className="btn primary" onClick={() => onNewSnapshot(row)}>New MEDDIC snapshot</button>
        )}
      </div>

      {/* One account can carry several deals — each with its own MEDDIC trail. */}
      <div className="deal-tabs">
        {accountDeals.map((r) => (
          <button
            key={r.deal._id}
            className={"deal-tab" + (r.deal._id === deal._id ? " active" : "")}
            onClick={() => onOpenClient(r.deal.slug)}
          >
            {r.deal.site}
            <span className="pill blue" style={{ marginLeft: 7 }}>{STAGE_BY_ID[r.state.stageId].name}</span>
            <span className="mono faint" style={{ marginLeft: 7, fontSize: 11 }}>{fmtEur(r.deal.acv)}</span>
            {(() => { const h = meddicHistory(r.deal.events, asOf); return h.length > 0 ? <span className="mono faint" style={{ marginLeft: 7, fontSize: 11 }}>{h.length} snapshot{h.length > 1 ? "s" : ""}</span> : null; })()}
          </button>
        ))}
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
              AI read on this account
              <span style={{ flex: 1 }} />
              {analysis && <CopyButton text={analysis} />}
              {analysis && <PrintButton text={analysis} title={`${deal.account} — MEDDIC analysis`} />}
              <button
                className="btn ai tiny"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setAnalysis(null);
                  try {
                    const others = accountDeals.filter((r) => r.deal._id !== deal._id).map((r) => `${r.deal.site} (slug ${r.deal.slug})`);
                    setAnalysis(
                      await askAi({
                        asOf,
                        workspace,
                        question:
                          `Analyse the MEDDIC snapshot history for the account ${deal.account}, focusing on the ${deal.site} deal (slug ${deal.slug})` +
                          (others.length ? ` but covering ALL deals at this account: ${others.join(", ")} — compare them.` : ".") +
                          ` Use EVERY snapshot in meddicSnapshotHistory, not just the latest. Structure: ` +
                          `### What improved (letter deltas with numbers) · ### What is structurally stuck (letters flat or low across snapshots, and what that costs) · ` +
                          `### The single highest-leverage gap to fix now (be concrete: who to call, what to ask) · ### Trajectory verdict (will it close by its target, and what the snapshot cadence says about deal hygiene). ` +
                          `Link every deal you mention.`,
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
            {analysis ? (
              <div className="report-card"><Md text={analysis} /></div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                What improved, what's structurally stuck, the highest-leverage gap — across every snapshot of every deal at this account.
              </p>
            )}
          </div>
        </>
      )}
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

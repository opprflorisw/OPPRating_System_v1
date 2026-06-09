import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { BOARD_STAGES, STAGE_BY_ID } from "../../convex/pipeline";
import { fmtEur, daysBetween } from "../../convex/derive";
import type { DealRow } from "../App";

interface Props {
  rows: DealRow[];
  asOf: string;
}

export function RollUp({ rows, asOf }: Props) {
  const weeklyReview = useAction(api.chat.weeklyReview);
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = rows.filter((r) => {
    const s = STAGE_BY_ID[r.state.stageId];
    return !s.terminal && !s.parking;
  });
  const pipeline = open.reduce((a, r) => a + r.deal.acv, 0);
  const weighted = open.reduce((a, r) => a + r.state.weighted, 0);
  const won = rows.filter((r) => r.state.stageId === "closed_won").reduce((a, r) => a + r.deal.acv, 0);
  const commit = open.filter((r) => r.state.forecastCategory === "Commit").reduce((a, r) => a + r.deal.acv, 0);

  const weekAgoMs = new Date(asOf).getTime() - 7 * 86400000;
  const moved: { row: DealRow; what: string; at: string }[] = [];
  for (const row of rows) {
    for (const e of row.deal.events) {
      if (e.at <= asOf && new Date(e.at).getTime() > weekAgoMs) {
        const what =
          e.type === "stage"
            ? `→ ${STAGE_BY_ID[e.to ?? ""]?.name ?? e.to}${e.override ? " ⚑ override" : ""}`
            : e.type === "template"
              ? `filed ${e.templateId?.replace(/_/g, " ")}`
              : e.type;
        moved.push({ row, what, at: e.at });
      }
    }
  }
  moved.sort((a, b) => (a.at < b.at ? 1 : -1));

  const flags = rows
    .map((row) => {
      const s = STAGE_BY_ID[row.state.stageId];
      const reasons: string[] = [];
      if (s.parking && row.state.disposition?.kind === "Stagnated") {
        if (row.state.disposition.reactivation && row.state.disposition.reactivation <= asOf)
          reasons.push(`reactivation date passed (${row.state.disposition.reactivation})`);
      }
      if (!s.terminal && !s.parking) {
        if (row.state.daysInStage > 60) reasons.push(`${row.state.daysInStage}d in ${s.name} (rotting)`);
        if (row.state.blocker) reasons.push(`blocker: ${row.state.blocker}`);
        if (row.state.overrides.some((o) => !o.resolved)) reasons.push("open override flag");
        if (row.state.meddic && daysBetween(row.state.meddic.at, asOf) > 14 && row.state.stageId === "negotiation")
          reasons.push("MEDDIC stale for Commit (CP3)");
        if (!row.state.meddic && (row.state.stageId === "solution_validation" || row.state.stageId === "poc"))
          reasons.push("no MEDDIC attached");
        const eb = row.state.meddic?.payload["eb"];
        if (typeof eb === "string" && /not engaged/i.test(eb)) reasons.push("EB identified but not engaged");
      }
      return { row, reasons };
    })
    .filter((f) => f.reasons.length > 0);

  return (
    <main className="rollup">
      <section className="ru-kpis">
        <div className="kpi big"><label>Open pipeline</label><b>{fmtEur(pipeline)}</b></div>
        <div className="kpi big"><label>Weighted forecast</label><b>{fmtEur(weighted)}</b></div>
        <div className="kpi big"><label>Commit</label><b>{fmtEur(commit)}</b></div>
        <div className="kpi big"><label>Won ARR</label><b>{fmtEur(won)}</b></div>
        <div className="kpi big"><label>Coverage vs target</label><b className="muted">[target to set]</b></div>
      </section>

      <div className="ru-grid">
        <section className="panel">
          <h4>Funnel · {asOf}</h4>
          <table className="ru-table">
            <thead><tr><th>Stage</th><th>#</th><th>ACV</th><th>Weighted</th></tr></thead>
            <tbody>
              {BOARD_STAGES.map((s) => {
                const inStage = rows.filter((r) => r.state.stageId === s.id);
                return (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td className="mono">{inStage.length}</td>
                    <td className="mono">{fmtEur(inStage.reduce((a, r) => a + r.deal.acv, 0))}</td>
                    <td className="mono">{fmtEur(inStage.reduce((a, r) => a + r.state.weighted, 0))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h4>What moved · last 7 days</h4>
          {moved.length === 0 ? <p className="muted">Nothing moved this week.</p> : (
            <ul className="ru-moved">
              {moved.slice(0, 14).map((m, i) => (
                <li key={i}>
                  <span className="mono">{m.at}</span> <b>{m.row.deal.account}</b> <span className="muted">{m.row.deal.site}</span> — {m.what}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel wide">
          <h4>Deal-level flags · what the review surfaces</h4>
          {flags.length === 0 ? <p className="muted">No flags. Suspicious — check the data.</p> : (
            <table className="ru-table">
              <thead><tr><th>Deal</th><th>Stage</th><th>Flags</th></tr></thead>
              <tbody>
                {flags.map((f) => (
                  <tr key={f.row.deal._id}>
                    <td><b>{f.row.deal.account}</b> <span className="muted">{f.row.deal.site}</span></td>
                    <td>{STAGE_BY_ID[f.row.state.stageId].name}</td>
                    <td>{f.reasons.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel wide">
          <h4>
            AI weekly review
            <button
              className="btn tiny on"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setReport(null);
                try { setReport(await weeklyReview({ asOf })); } finally { setBusy(false); }
              }}
            >
              {busy ? "Generating…" : "Generate for week ending " + asOf}
            </button>
          </h4>
          {report ? <pre className="report">{report}</pre> : (
            <p className="muted">
              The master skill: every record + the pipeline state goes to the model, the weekly company review comes back.
              Needs GOOGLE_API_KEY set in Convex.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

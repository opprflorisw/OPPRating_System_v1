import { useMemo, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { STAGE_BY_ID, MEDDIC_LETTERS, boardStages } from "../../convex/pipeline";
import { replay, fmtEur, meddicHistory, letterScore, meddicPct } from "../../convex/derive";
import { Md, CopyButton, PrintButton } from "./Markdown";
import type { DealRow } from "../App";

interface Props {
  rows: DealRow[];
  asOf: string;
  workspace: string;
}

// The sales-leader Monday view: built on the deltas of the last 7 days —
// stage moves, MEDDIC letter changes, blockers — not on raw filings.
export function Standup({ rows, asOf, workspace }: Props) {
  const standup = useAction(api.chat.standup);
  const [brief, setBrief] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastWeek = new Date(new Date(asOf).getTime() - 7 * 86400000).toISOString().slice(0, 10);

  const data = useMemo(() => {
    const prevStates = rows.map((r) => ({ deal: r.deal, state: replay(r.deal.events, r.deal.acv, lastWeek) }));
    const openNow = rows.filter((r) => !STAGE_BY_ID[r.state.stageId].terminal && !STAGE_BY_ID[r.state.stageId].parking);
    const openPrev = prevStates.filter((r) => !STAGE_BY_ID[r.state.stageId].terminal && !STAGE_BY_ID[r.state.stageId].parking);
    const kpi = (now: number, prev: number) => ({ now, delta: now - prev });

    const kpis = {
      pipeline: kpi(openNow.reduce((a, r) => a + r.deal.acv, 0), openPrev.reduce((a, r) => a + r.deal.acv, 0)),
      weighted: kpi(openNow.reduce((a, r) => a + r.state.weighted, 0), openPrev.reduce((a, r) => a + r.state.weighted, 0)),
      commit: kpi(
        openNow.filter((r) => r.state.forecastCategory === "Commit").reduce((a, r) => a + r.deal.acv, 0),
        openPrev.filter((r) => r.state.forecastCategory === "Commit").reduce((a, r) => a + r.deal.acv, 0)
      ),
      won: kpi(
        rows.filter((r) => r.state.stageId === "closed_won").reduce((a, r) => a + r.deal.acv, 0),
        prevStates.filter((r) => r.state.stageId === "closed_won").reduce((a, r) => a + r.deal.acv, 0)
      ),
    };

    const changes = rows
      .map((row) => {
        const prev = prevStates.find((p) => p.deal._id === row.deal._id)!;
        const items: { kind: "move" | "meddic" | "blocker" | "gate" | "flag"; text: string }[] = [];

        if (prev.state.stageId !== row.state.stageId) {
          items.push({ kind: "move", text: `${STAGE_BY_ID[prev.state.stageId].name} → ${STAGE_BY_ID[row.state.stageId].name}` });
        }
        // MEDDIC deltas: latest snapshot now vs latest snapshot a week ago.
        const hNow = meddicHistory(row.deal.events, asOf);
        const hPrev = meddicHistory(row.deal.events, lastWeek);
        const sNow = hNow[hNow.length - 1];
        const sPrev = hPrev[hPrev.length - 1];
        if (sNow && sNow.at > lastWeek) {
          for (const m of MEDDIC_LETTERS) {
            const a = sPrev ? letterScore(sPrev.payload, m.key) : null;
            const b = letterScore(sNow.payload, m.key);
            if (a !== null && b !== null && a !== b) {
              items.push({ kind: "meddic", text: `${m.letter} (${m.label}): ${a} → ${b}${b > a ? " ▲" : " ▼"}` });
            }
          }
          const pNow = meddicPct(sNow.payload);
          const pPrev = sPrev ? meddicPct(sPrev.payload) : null;
          if (pNow !== null && pPrev !== null && pNow === pPrev) {
            items.push({ kind: "meddic", text: `Snapshot refreshed, score flat at ${pNow}% — architecture not improving` });
          }
        }
        if (row.state.blocker && row.state.blocker !== prev.state.blocker) {
          items.push({ kind: "blocker", text: `New blocker: ${row.state.blocker}` });
        }
        if (!row.state.blocker && prev.state.blocker) {
          items.push({ kind: "blocker", text: `Blocker resolved: ${prev.state.blocker}` });
        }
        const gatesPassed = row.deal.events.filter(
          (e) => e.at > lastWeek && e.at <= asOf && e.gatesSatisfied && e.gatesSatisfied.length > 0
        ).reduce((a, e) => a + (e.gatesSatisfied?.length ?? 0), 0);
        if (gatesPassed > 0) items.push({ kind: "gate", text: `${gatesPassed} gate(s) satisfied` });
        if (row.state.overrides.some((o) => !o.resolved)) items.push({ kind: "flag", text: "Open override flag" });

        return { row, items };
      })
      .filter((c) => c.items.length > 0);

    const blockers = rows
      .filter((r) => r.state.blocker && !STAGE_BY_ID[r.state.stageId].terminal && !STAGE_BY_ID[r.state.stageId].parking)
      .map((r) => ({ row: r, blocker: r.state.blocker, days: r.state.daysSinceTouch }));

    const quiet = rows.filter(
      (r) =>
        !STAGE_BY_ID[r.state.stageId].terminal &&
        !STAGE_BY_ID[r.state.stageId].parking &&
        !changes.some((c) => c.row.deal._id === r.deal._id)
    );

    return { kpis, changes, blockers, quiet };
  }, [rows, asOf, lastWeek]);

  return (
    <main className="page">
      <div className="page-head">
        <h2>Monday Stand-up</h2>
        <span className="muted">week ending {asOf} · vs {lastWeek}</span>
        <span style={{ flex: 1 }} />
        <button
          className="btn ai"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setBrief(null);
            try { setBrief(await standup({ asOf, workspace })); } finally { setBusy(false); }
          }}
        >
          {busy ? "Writing the brief…" : "✦ Generate the stand-up brief"}
        </button>
      </div>

      <div className="standup-grid">
        <Stat label="Open pipeline" v={data.kpis.pipeline} />
        <Stat label="Weighted" v={data.kpis.weighted} />
        <Stat label="Commit" v={data.kpis.commit} />
        <Stat label="Won ARR" v={data.kpis.won} />
      </div>

      {brief && (
        <div className="report-card" style={{ marginBottom: 14 }}>
          <div className="report-tools">
            <span className="faint" style={{ fontSize: 11 }}>Generated by Gemini · {new Date().toLocaleTimeString()}</span>
            <span style={{ flex: 1 }} />
            <CopyButton text={brief} />
            <PrintButton text={brief} title={`Monday Stand-up · week ending ${asOf}`} />
          </div>
          <Md text={brief} />
        </div>
      )}

      <div className="page-head" style={{ marginTop: 6 }}><h2 style={{ fontSize: 14 }}>What changed</h2></div>
      {data.changes.length === 0 ? (
        <div className="panel"><p className="muted" style={{ margin: 0 }}>Nothing moved this week. That is itself the finding.</p></div>
      ) : (
        <div className="change-cards">
          {data.changes.map(({ row, items }) => (
            <div className="change-card" key={row.deal._id}>
              <h5>
                <span className={"dot " + row.state.health} />
                {row.deal.account} <span className="faint" style={{ fontWeight: 400 }}>{row.deal.site}</span>
                <span style={{ flex: 1 }} />
                <span className="pill blue">{STAGE_BY_ID[row.state.stageId].name}</span>
              </h5>
              <ul>
                {items.map((it, i) => (
                  <li key={i} style={it.kind === "blocker" || it.kind === "flag" ? { color: "var(--amber)" } : it.kind === "move" ? { color: "var(--accent)" } : {}}>
                    {it.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="page-head" style={{ marginTop: 18 }}><h2 style={{ fontSize: 14 }}>Blockers to break</h2></div>
      {data.blockers.length === 0 ? (
        <div className="panel"><p className="muted" style={{ margin: 0 }}>No open blockers.</p></div>
      ) : (
        <table className="table">
          <thead><tr><th>Deal</th><th>Blocker</th><th>Stage</th><th>Last touch</th></tr></thead>
          <tbody>
            {data.blockers.map((b) => (
              <tr key={b.row.deal._id}>
                <td><b>{b.row.deal.account}</b> <span className="faint">{b.row.deal.site}</span></td>
                <td>{b.blocker}</td>
                <td><span className="pill blue">{STAGE_BY_ID[b.row.state.stageId].name}</span></td>
                <td className="mono" style={{ fontSize: 11 }}>{b.days}d ago</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data.quiet.length > 0 && (
        <>
          <div className="page-head" style={{ marginTop: 18 }}><h2 style={{ fontSize: 14 }}>Quiet deals — no movement</h2></div>
          <div className="panel">
            <p style={{ margin: 0, fontSize: 12.5 }}>
              {data.quiet.map((r) => (
                <span key={r.deal._id} className="pill outline" style={{ marginRight: 6 }}>
                  {r.deal.account} · {r.state.daysInStage}d in {STAGE_BY_ID[r.state.stageId].short}
                </span>
              ))}
            </p>
          </div>
        </>
      )}
    </main>
  );
}

function Stat({ label, v }: { label: string; v: { now: number; delta: number } }) {
  return (
    <div className="stat">
      <label>{label}</label>
      <b>{fmtEur(v.now)}</b>
      {v.delta !== 0 && (
        <span className={"d " + (v.delta > 0 ? "delta-up" : "delta-down")}>
          {v.delta > 0 ? "▲ +" : "▼ "}{fmtEur(Math.abs(v.delta)).replace("€", "€")}
        </span>
      )}
    </div>
  );
}

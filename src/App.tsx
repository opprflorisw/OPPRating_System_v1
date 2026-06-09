import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SIM_START, SIM_TODAY, STAGE_BY_ID, nextStageId } from "../convex/pipeline";
import { replay, fmtEur, type DealState } from "../convex/derive";
import type { Deal } from "./types";
import { Board } from "./components/Board";
import { RecordCard } from "./components/RecordCard";
import { GateModal } from "./components/GateModal";
import { UpdateModal } from "./components/UpdateModal";
import { RollUp } from "./components/RollUp";
import { ChatDock } from "./components/ChatDock";

export interface DealRow {
  deal: Deal;
  state: DealState;
}

export default function App() {
  const deals = useQuery(api.deals.list, {}) as Deal[] | undefined;
  const resetScenario = useMutation(api.deals.resetScenario);

  const [asOf, setAsOf] = useState<string>(SIM_TODAY);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<DealRow | null>(null);
  const [updateFor, setUpdateFor] = useState<DealRow | null>(null);
  const [view, setView] = useState<"board" | "rollup">("board");
  const [resetting, setResetting] = useState(false);

  const live = asOf === SIM_TODAY;

  const rows: DealRow[] = useMemo(
    () => (deals ?? []).map((deal) => ({ deal, state: replay(deal.events, deal.acv, asOf) })),
    [deals, asOf]
  );

  const selected = rows.find((r) => r.deal._id === selectedId) ?? null;

  const totals = useMemo(() => {
    const open = rows.filter((r) => {
      const s = STAGE_BY_ID[r.state.stageId];
      return !s.terminal && !s.parking;
    });
    const pipeline = open.reduce((a, r) => a + r.deal.acv, 0);
    const weighted = open.reduce((a, r) => a + r.state.weighted, 0);
    const won = rows
      .filter((r) => r.state.stageId === "closed_won")
      .reduce((a, r) => a + r.deal.acv, 0);
    return { pipeline, weighted, won, openCount: open.length };
  }, [rows]);

  // Time slider mapping: day offset from SIM_START
  const totalDays = Math.round((new Date(SIM_TODAY).getTime() - new Date(SIM_START).getTime()) / 86400000);
  const dayOffset = Math.round((new Date(asOf).getTime() - new Date(SIM_START).getTime()) / 86400000);
  const setDay = (n: number) => {
    const d = new Date(new Date(SIM_START).getTime() + n * 86400000);
    setAsOf(d.toISOString().slice(0, 10));
  };

  const seeded = deals !== undefined && deals.length > 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">OPPR</span>
          <span className="brand-rest">ATING SYSTEM</span>
          <span className="brand-sub">Commercial Engine · Pipeline Machine · v1</span>
        </div>
        <div className="kpis">
          <div className="kpi"><label>Open pipeline</label><b>{fmtEur(totals.pipeline)}</b></div>
          <div className="kpi"><label>Weighted</label><b>{fmtEur(totals.weighted)}</b></div>
          <div className="kpi"><label>Won ARR</label><b>{fmtEur(totals.won)}</b></div>
          <div className="kpi"><label>Open deals</label><b>{totals.openCount}</b></div>
        </div>
        <div className="topbar-actions">
          <button className={view === "board" ? "btn on" : "btn"} onClick={() => setView("board")}>Board</button>
          <button className={view === "rollup" ? "btn on" : "btn"} onClick={() => setView("rollup")}>Weekly roll-up</button>
          <button
            className="btn ghost"
            disabled={resetting}
            onClick={async () => {
              if (!confirm("Reset the simulated scenario? All your changes are wiped and the seed data is restored.")) return;
              setResetting(true);
              try { await resetScenario({}); } finally { setResetting(false); }
            }}
          >
            {resetting ? "Resetting…" : seeded ? "Reset scenario" : "Load scenario"}
          </button>
        </div>
      </header>

      <div className="timebar">
        <span className="timebar-label">REPLAY</span>
        <span className="time-date mono">{SIM_START}</span>
        <input
          type="range"
          min={0}
          max={totalDays}
          value={dayOffset}
          onChange={(e) => setDay(Number(e.target.value))}
        />
        <span className="time-date mono">{SIM_TODAY}</span>
        <span className={live ? "time-now live" : "time-now"}>
          {live ? "● LIVE" : `VIEWING ${asOf}`}
        </span>
        {!live && (
          <button className="btn tiny" onClick={() => setAsOf(SIM_TODAY)}>Jump to today</button>
        )}
        <span className="sim-tag">SIMULATED DATA</span>
      </div>

      {deals === undefined ? (
        <div className="empty">Connecting to Convex…</div>
      ) : !seeded ? (
        <div className="empty">
          <p>No scenario loaded yet.</p>
          <button className="btn on" onClick={() => resetScenario({})}>Load the simulated scenario (13 NL targets)</button>
        </div>
      ) : view === "board" ? (
        <Board
          rows={rows}
          live={live}
          onSelect={(id) => setSelectedId(id)}
          onRequestMove={(row) => live && setPendingMove(row)}
        />
      ) : (
        <RollUp rows={rows} asOf={asOf} />
      )}

      {selected && (
        <RecordCard
          row={selected}
          live={live}
          asOf={asOf}
          onClose={() => setSelectedId(null)}
          onFileUpdate={() => setUpdateFor(selected)}
          onRequestMove={() => live && setPendingMove(selected)}
        />
      )}

      {pendingMove && live && (
        <GateModal
          row={pendingMove}
          asOf={asOf}
          onClose={() => setPendingMove(null)}
        />
      )}

      {updateFor && live && (
        <UpdateModal
          row={updateFor}
          asOf={asOf}
          onClose={() => setUpdateFor(null)}
        />
      )}

      <ChatDock asOf={asOf} />
    </div>
  );
}

export function stageLabel(id: string): string {
  return STAGE_BY_ID[id]?.name ?? id;
}

export function canAdvance(row: DealRow): boolean {
  return nextStageId(row.state.stageId) !== null;
}

import { useState } from "react";
import { BOARD_STAGES, STAGES, STAGE_BY_ID, nextStageId } from "../../convex/pipeline";
import { gateProgress, fmtEur } from "../../convex/derive";
import type { DealRow } from "../App";

interface Props {
  rows: DealRow[];
  live: boolean;
  onSelect: (dealId: string) => void;
  onRequestMove: (row: DealRow) => void;
}

export function Board({ rows, live, onSelect, onRequestMove }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const parked = STAGES.filter((s) => s.parking);

  return (
    <main className="board">
      {BOARD_STAGES.map((stage) => {
        const inStage = rows.filter((r) => r.state.stageId === stage.id);
        const sum = inStage.reduce((a, r) => a + r.deal.acv, 0);
        const dragRow = rows.find((r) => r.deal._id === dragId);
        const isDropTarget =
          live && dragRow != null && nextStageId(dragRow.state.stageId) === stage.id;
        return (
          <section
            key={stage.id}
            className={"col" + (isDropTarget ? " droppable" : "") + (stage.terminal ? " won" : "")}
            onDragOver={(e) => { if (isDropTarget) e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              if (isDropTarget && dragRow) onRequestMove(dragRow);
              setDragId(null);
            }}
          >
            <header className="col-head">
              <div className="col-title">
                <span className="col-name">{stage.name}</span>
                {stage.checkpoint && <span className="cp-badge">{stage.checkpoint.id}</span>}
              </div>
              <div className="col-meta mono">
                {inStage.length} · {fmtEur(sum)} · {stage.probability}%
              </div>
            </header>
            <div className="col-body">
              {inStage.map((row) => (
                <Card
                  key={row.deal._id}
                  row={row}
                  live={live}
                  onSelect={onSelect}
                  dragging={dragId === row.deal._id}
                  setDragId={setDragId}
                />
              ))}
            </div>
          </section>
        );
      })}

      <section className="col parked">
        <header className="col-head">
          <div className="col-title"><span className="col-name">Parked</span></div>
          <div className="col-meta mono">Stagnated · watch-list / Lost</div>
        </header>
        <div className="col-body">
          {parked.map((stage) =>
            rows
              .filter((r) => r.state.stageId === stage.id)
              .map((row) => (
                <Card key={row.deal._id} row={row} live={live} onSelect={onSelect} dragging={false} setDragId={() => {}} />
              ))
          )}
        </div>
      </section>
    </main>
  );
}

function Card({
  row, live, onSelect, dragging, setDragId,
}: {
  row: DealRow;
  live: boolean;
  onSelect: (id: string) => void;
  dragging: boolean;
  setDragId: (id: string | null) => void;
}) {
  const { deal, state } = row;
  const stage = STAGE_BY_ID[state.stageId];
  const progress = gateProgress(stage, state);
  const pct = progress.total === 0 ? 100 : Math.round((progress.done / progress.total) * 100);
  const unresolvedOverride = state.overrides.some((o) => !o.resolved);
  const movable = live && !stage.terminal && !stage.parking;

  return (
    <article
      className={"card" + (dragging ? " dragging" : "") + (state.health === "R" ? " hot" : "")}
      draggable={movable}
      onDragStart={() => setDragId(deal._id)}
      onDragEnd={() => setDragId(null)}
      onClick={() => onSelect(deal._id)}
    >
      <div className="card-top">
        <span className={"dot " + state.health} title={`Health ${state.health}`} />
        <span className="card-account">{deal.account}</span>
        {unresolvedOverride && <span className="flag" title="Moved past unmet gates">⚑ OVERRIDE</span>}
        <span className="card-acv mono">{fmtEur(deal.acv)}</span>
      </div>
      <div className="card-site">{deal.site}</div>
      {state.disposition ? (
        <div className="card-disp">
          {state.disposition.kind}: {state.disposition.reason}
          {state.disposition.reactivation && (
            <span className="mono"> · reactivate {state.disposition.reactivation}</span>
          )}
        </div>
      ) : (
        <>
          <div className="card-gates">
            <div className="gauge"><div className="gauge-fill" style={{ width: pct + "%" }} /></div>
            <span className="mono">{progress.done}/{progress.total} gates</span>
          </div>
          <div className="card-foot mono">
            <span className={state.daysInStage > 60 ? "rot" : ""}>{state.daysInStage}d in stage</span>
            {state.blocker && <span className="blocker" title={state.blocker}>⛔ {truncate(state.blocker, 26)}</span>}
            <span className="fc">{state.forecastCategory}</span>
          </div>
        </>
      )}
    </article>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

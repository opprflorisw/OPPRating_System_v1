import { useState } from "react";
import { boardStages, STAGES, STAGE_BY_ID, nextStageId } from "../../convex/pipeline";
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
      {boardStages().map((stage) => {
        const inStage = rows.filter((r) => r.state.stageId === stage.id);
        const sum = inStage.reduce((a, r) => a + r.deal.acv, 0);
        const dragRow = rows.find((r) => r.deal._id === dragId);
        const isDropTarget = live && dragRow != null && nextStageId(dragRow.state.stageId) === stage.id;
        return (
          <section
            key={stage.id}
            className={"col" + (isDropTarget ? " droppable" : "")}
            onDragOver={(e) => { if (isDropTarget) e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              if (isDropTarget && dragRow) onRequestMove(dragRow);
              setDragId(null);
            }}
          >
            <header className="col-head">
              <span className="col-name">{stage.name}</span>
              {stage.checkpoint && <span className="pill violet">{stage.checkpoint.id}</span>}
              <span className="col-count">{inStage.length}</span>
              <span className="col-sum">{fmtEur(sum)}</span>
            </header>
            <div className="col-body">
              {inStage.map((row) => (
                <Card key={row.deal._id} row={row} live={live} onSelect={onSelect} onRequestMove={onRequestMove} dragging={dragId === row.deal._id} setDragId={setDragId} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="col parked">
        <header className="col-head">
          <span className="col-name">Parked</span>
          <span className="col-count">{rows.filter((r) => STAGE_BY_ID[r.state.stageId].parking).length}</span>
          <span className="col-sum">watch-list</span>
        </header>
        <div className="col-body">
          {parked.map((stage) =>
            rows
              .filter((r) => r.state.stageId === stage.id)
              .map((row) => (
                <Card key={row.deal._id} row={row} live={live} onSelect={onSelect} onRequestMove={() => {}} dragging={false} setDragId={() => {}} />
              ))
          )}
        </div>
      </section>
    </main>
  );
}

function Card({
  row, live, onSelect, onRequestMove, dragging, setDragId,
}: {
  row: DealRow;
  live: boolean;
  onSelect: (id: string) => void;
  onRequestMove: (row: DealRow) => void;
  dragging: boolean;
  setDragId: (id: string | null) => void;
}) {
  const { deal, state } = row;
  const stage = STAGE_BY_ID[state.stageId];
  const progress = gateProgress(stage, state);
  const pct = progress.total === 0 ? 100 : Math.round((progress.done / progress.total) * 100);
  const unresolvedOverride = state.overrides.some((o) => !o.resolved);
  const movable = live && !stage.terminal && !stage.parking;
  const ready = movable && stage.exitGates.length > 0 && progress.done === progress.total;

  return (
    <article
      className={"card" + (dragging ? " dragging" : "")}
      draggable={movable}
      onDragStart={() => setDragId(deal._id)}
      onDragEnd={() => setDragId(null)}
      onClick={() => onSelect(deal._id)}
    >
      <div className="card-top">
        <span className={"dot " + state.health} title={`Health ${state.health}`} />
        <span className="card-account">{deal.account}</span>
        <span className="card-acv">{fmtEur(deal.acv)}</span>
      </div>
      <div className="card-site">{deal.site}</div>
      {state.disposition ? (
        <div className="card-disp">
          <span className={"pill " + (state.disposition.kind === "Stagnated" ? "amber" : "red")}>{state.disposition.kind}</span>{" "}
          {state.disposition.reason}
          {state.disposition.reactivation && <span className="faint mono"> · {state.disposition.reactivation}</span>}
        </div>
      ) : (
        <>
          {!stage.terminal && (
            <div className="card-gates">
              <div className="gauge"><div className={"gauge-fill" + (pct === 100 ? " full" : "")} style={{ width: pct + "%" }} /></div>
              <span className="mono">{progress.done}/{progress.total}</span>
            </div>
          )}
          <div className="card-foot">
            {unresolvedOverride && <span className="pill red">⚑ override</span>}
            {state.blocker && <span className="pill amber" title={state.blocker}>blocked</span>}
            <span className={"pill" + (state.daysInStage > 60 ? " red" : "")}>{state.daysInStage}d</span>
            {ready ? (
              <button
                className="btn advance tiny"
                style={{ marginLeft: "auto" }}
                onClick={(e) => { e.stopPropagation(); onRequestMove(row); }}
              >
                Advance →
              </button>
            ) : (
              <span className="pill outline">{state.forecastCategory}</span>
            )}
          </div>
        </>
      )}
    </article>
  );
}

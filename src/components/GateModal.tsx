import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { STAGE_BY_ID, nextStageId } from "../../convex/pipeline";
import type { DealRow } from "../App";

interface Props {
  row: DealRow;
  asOf: string;
  onClose: () => void;
}

export function GateModal({ row, asOf, onClose }: Props) {
  const { deal, state } = row;
  const stage = STAGE_BY_ID[state.stageId];
  const nextId = nextStageId(state.stageId);
  const next = nextId ? STAGE_BY_ID[nextId] : null;
  const appendEvent = useMutation(api.deals.appendEvent);
  const [busy, setBusy] = useState(false);

  if (!next) return null;

  const unmet = stage.exitGates.filter((g) => !state.gates[g.id]);
  const allMet = unmet.length === 0;

  const move = async (override: boolean) => {
    setBusy(true);
    try {
      await appendEvent({
        dealId: deal._id as never,
        at: asOf,
        author: "Floris",
        discipline: "Sales",
        type: "stage",
        from: stage.id,
        to: next.id,
        override,
        note: override
          ? `OVERRIDE: advanced to ${next.name} with ${unmet.length} unmet gate(s): ${unmet.map((g) => g.label).join("; ")}`
          : `Advanced to ${next.name}. All ${stage.exitGates.length} exit gates met.`,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim modal-scrim" onClick={onClose} />
      <div className="modal">
        <h3>
          {stage.name} → {next.name}{" "}
          {stage.checkpoint && <span className="pill violet">{stage.checkpoint.id}</span>}
        </h3>
        <p className="modal-sub">
          {deal.account} · {deal.site}. {stage.checkpoint ? stage.checkpoint.label + "." : "Exit gates must be true to advance."}
        </p>
        <ul className="gates">
          {stage.exitGates.map((g) => {
            const ev = state.gates[g.id];
            return (
              <li key={g.id} className={ev ? "met" : "unmet"}>
                <span className="gate-check">{ev ? "✓" : ""}</span>
                <span className="gate-label">{g.label}{g.cp && <em className="cp-mini">{g.cp}</em>}</span>
                {ev ? <span className="gate-ev">{ev.at} · {ev.via}</span> : <span className="pill red">missing</span>}
              </li>
            );
          })}
        </ul>
        <footer className="modal-foot">
          <button className="btn quiet" onClick={onClose} disabled={busy}>Cancel</button>
          <span className="spacer" />
          {allMet ? (
            <button className="btn primary" onClick={() => move(false)} disabled={busy}>
              Advance — gates clear
            </button>
          ) : (
            <>
              <span className="modal-warn">{unmet.length} gate(s) unmet — file the missing updates first, or:</span>
              <button className="btn skip" onClick={() => move(true)} disabled={busy}>
                ⚑ Force with override flag
              </button>
            </>
          )}
        </footer>
      </div>
    </>
  );
}

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TEAM, STAGE_BY_ID } from "../../convex/pipeline";
import type { DealRow } from "../App";

// Parking or losing a deal is a verdict, not a filing — its own modal,
// visually distinct from stage templates.
export function DispositionModal({ row, asOf, onClose }: { row: DealRow; asOf: string; onClose: () => void }) {
  const { deal, state } = row;
  const appendEvent = useMutation(api.deals.appendEvent);
  const [kind, setKind] = useState<"Stagnated" | "Closed Lost">("Stagnated");
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [reactivation, setReactivation] = useState("");
  const [author, setAuthor] = useState(TEAM[0]);
  const [busy, setBusy] = useState(false);

  const reasons =
    kind === "Stagnated"
      ? ["Frozen budget", "Vendor processing", "EB / leadership change", "Doing it themselves", "Wrong timing", "Other"]
      : ["No EB access", "No urgency", "Lost to competitor", "Budget reallocated", "Internal blocker (ERP/MES)", "Champion lost", "Pricing", "Other"];

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await appendEvent({
        dealId: deal._id as never,
        at: asOf, author, discipline: "Sales", type: "template", templateId: "disposition",
        payload: { kind, reason, detail, reactivation: kind === "Stagnated" ? reactivation : "" },
      });
      await appendEvent({
        dealId: deal._id as never,
        at: asOf, author, discipline: "Sales", type: "stage",
        from: state.stageId, to: kind === "Stagnated" ? "stagnated" : "closed_lost",
        note: `Paused-from: ${STAGE_BY_ID[state.stageId].name}. Reason: ${reason}.`,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim modal-scrim" onClick={onClose} />
      <div className="modal" style={{ width: "min(520px, 94vw)" }}>
        <h3>Park or lose · {deal.account}</h3>
        <p className="modal-sub">
          This takes the deal off the active board. Stagnated keeps a reactivation date and stays on the monthly watch-list; Closed Lost is final and needs a reason.
        </p>
        <div className="tpl-form">
          <div style={{ display: "flex", gap: 8 }}>
            <button className={"btn park" + (kind === "Stagnated" ? "" : " quiet")} style={kind !== "Stagnated" ? { opacity: 0.55 } : {}} onClick={() => setKind("Stagnated")}>⏸ Stagnate</button>
            <button className={"btn danger" + (kind === "Closed Lost" ? "" : " quiet")} style={kind !== "Closed Lost" ? { opacity: 0.55 } : {}} onClick={() => setKind("Closed Lost")}>✕ Close Lost</button>
          </div>
          <label className="f-field">
            <span>Reason (required)</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">—</option>
              {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="f-field">
            <span>Detail</span>
            <textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
          </label>
          {kind === "Stagnated" && (
            <label className="f-field">
              <span>Reactivation date</span>
              <input type="date" value={reactivation} onChange={(e) => setReactivation(e.target.value)} />
            </label>
          )}
          <div className="filed-by">
            <span className="muted" style={{ fontSize: 12 }}>Decided by</span>
            <select value={author} onChange={(e) => setAuthor(e.target.value)}>
              {TEAM.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <footer className="modal-foot">
          <button className="btn quiet" onClick={onClose} disabled={busy}>Cancel</button>
          <span className="spacer" />
          <button className={kind === "Stagnated" ? "btn park" : "btn danger solid"} onClick={submit} disabled={busy || !reason}>
            {busy ? "Filing…" : kind === "Stagnated" ? "Park the deal" : "Close lost"}
          </button>
        </footer>
      </div>
    </>
  );
}

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TEMPLATES, type Template, type TemplateField } from "../../convex/pipeline";
import type { DealRow } from "../App";

interface Props {
  row: DealRow;
  asOf: string;
  onClose: () => void;
}

export function UpdateModal({ row, asOf, onClose }: Props) {
  const { deal, state } = row;
  const available = useMemo(
    () => TEMPLATES.filter((t) => t.stages.includes(state.stageId)),
    [state.stageId]
  );
  const [tpl, setTpl] = useState<Template | null>(available.length === 1 ? available[0] : null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [busy, setBusy] = useState(false);
  const appendEvent = useMutation(api.deals.appendEvent);

  const set = (id: string, v: string | boolean) => setValues((prev) => ({ ...prev, [id]: v }));

  const submit = async () => {
    if (!tpl) return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      const gates: string[] = [];
      for (const f of tpl.fields) {
        const v = values[f.id];
        if (v === undefined || v === "") continue;
        payload[f.id] = f.kind === "number" || f.kind === "currency" ? Number(v) : v;
        if (f.satisfiesGate && (f.kind === "check" ? v === true : String(v).trim() !== "")) {
          gates.push(f.satisfiesGate);
        }
      }
      await appendEvent({
        dealId: deal._id as never,
        at: asOf,
        author: "Floris",
        discipline: tpl.discipline,
        type: "template",
        templateId: tpl.id,
        payload,
        gatesSatisfied: gates.length ? gates : undefined,
      });
      // Disposition templates also park the deal.
      if (tpl.id === "disposition" && (values["kind"] === "Stagnated" || values["kind"] === "Closed Lost")) {
        await appendEvent({
          dealId: deal._id as never,
          at: asOf,
          author: "Floris",
          discipline: "Sales",
          type: "stage",
          from: state.stageId,
          to: values["kind"] === "Stagnated" ? "stagnated" : "closed_lost",
          note: `Paused-from: ${state.stageId}. Reason: ${values["reason"] ?? "unspecified"}.`,
        });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim modal-scrim" onClick={onClose} />
      <div className="modal">
        <header className="modal-head"><h3>File an update · {deal.account}</h3></header>
        {!tpl ? (
          <div className="tpl-pick">
            <p className="modal-sub">Pick the record to file at this stage. The template carries the standard; gates tick themselves.</p>
            {available.map((t) => (
              <button key={t.id} className="tpl-option" onClick={() => setTpl(t)}>
                <b>{t.name}</b>
                <span className="tpl-disc mono">{t.discipline}</span>
                <span className="tpl-desc">{t.description}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <p className="modal-sub">
              <b>{tpl.name}</b> · {tpl.discipline}. Fields marked ⛩ satisfy an exit gate when filled.
            </p>
            <div className="tpl-form">
              {tpl.fields.map((f) => (
                <Field key={f.id} field={f} value={values[f.id]} onChange={(v) => set(f.id, v)} />
              ))}
            </div>
            <footer className="modal-foot">
              <button className="btn ghost" onClick={() => (available.length === 1 ? onClose() : setTpl(null))} disabled={busy}>Back</button>
              <button className="btn on" onClick={submit} disabled={busy}>{busy ? "Filing…" : "File record"}</button>
            </footer>
          </>
        )}
      </div>
    </>
  );
}

function Field({ field, value, onChange }: {
  field: TemplateField;
  value: string | boolean | undefined;
  onChange: (v: string | boolean) => void;
}) {
  const gateMark = field.satisfiesGate ? " ⛩" : "";
  if (field.kind === "check") {
    return (
      <label className="f-check">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        <span>{field.label}{gateMark}</span>
      </label>
    );
  }
  if (field.kind === "select") {
    return (
      <label className="f-field">
        <span>{field.label}{gateMark}</span>
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    );
  }
  if (field.kind === "longtext") {
    return (
      <label className="f-field">
        <span>{field.label}{gateMark}</span>
        <textarea rows={3} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }
  return (
    <label className="f-field">
      <span>{field.label}{gateMark}</span>
      <input
        type={field.kind === "date" ? "date" : field.kind === "number" || field.kind === "currency" ? "number" : "text"}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

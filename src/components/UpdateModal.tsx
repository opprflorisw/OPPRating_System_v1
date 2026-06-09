import { useContext, useMemo, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TEMPLATES, TEMPLATE_BY_ID, TEAM, type Template, type TemplateField } from "../../convex/pipeline";
import { USERS } from "../../convex/users";
import { meddicHistory } from "../../convex/derive";
import { GuidedChat } from "./GuidedChat";
import { UserContext } from "../context";
import type { DealRow } from "../App";

export function authorOptions(current: string): string[] {
  return Array.from(new Set([current, ...USERS.map((u) => u.name), ...TEAM]));
}

interface Props {
  row: DealRow;
  asOf: string;
  preselect?: string;
  onClose: () => void;
}

type Provenance = "manual" | "ai" | "ai-edited";
type Step = "mode" | "guided" | "evidence" | "form";

interface FieldState {
  value: string | boolean;
  provenance: Provenance;
  quote?: string;
  accepted: boolean;
}

export function UpdateModal({ row, asOf, preselect, onClose }: Props) {
  const { deal, state } = row;
  const available = useMemo(
    () => TEMPLATES.filter((t) => t.stages.includes(state.stageId) && t.id !== "disposition"),
    [state.stageId]
  );
  const user = useContext(UserContext);
  const preselected = preselect ? TEMPLATE_BY_ID[preselect] : available.length === 1 ? available[0] : null;
  const [tpl, setTpl] = useState<Template | null>(preselected);
  const [step, setStep] = useState<Step>("mode");
  const [author, setAuthor] = useState(user.name);
  const [fields, setFields] = useState<Record<string, FieldState>>({});
  const [evidenceText, setEvidenceText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [recording, setRecording] = useState(false);
  const [uploaded, setUploaded] = useState<{ id: string; name: string; mime: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const appendEvent = useMutation(api.deals.appendEvent);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const extract = useAction(api.extract.extract);

  const setField = (id: string, patch: Partial<FieldState>) =>
    setFields((prev) => {
      const base: FieldState = prev[id] ?? { value: "", provenance: "manual", accepted: true };
      return { ...prev, [id]: { ...base, ...patch } };
    });

  const ensureAllFields = (next: Record<string, FieldState>, t: Template) => {
    for (const f of t.fields) {
      if (!next[f.id]) next[f.id] = { value: f.kind === "check" ? false : "", provenance: "manual", accepted: true };
    }
    return next;
  };

  // ── Voice memo (evidence mode) ────────────────────────────────────────
  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setFiles((f) => [...f, new File([blob], `voice-memo-${Date.now()}.webm`, { type: blob.type })]);
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setError("Microphone not available.");
    }
  };

  // ── AI extraction (evidence mode) ─────────────────────────────────────
  const runExtract = async () => {
    if (!tpl) return;
    setBusy("Extracting from evidence…");
    setError(null);
    try {
      const fileIds: string[] = [];
      for (const file of files) {
        const url = await generateUploadUrl({});
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
        const { storageId } = (await res.json()) as { storageId: string };
        fileIds.push(storageId);
      }
      setUploaded(fileIds.map((id, i) => ({ id, name: files[i].name, mime: files[i].type })));
      const proposals = await extract({
        templateId: tpl.id,
        stageId: state.stageId,
        account: `${deal.account} · ${deal.site}`,
        text: evidenceText || undefined,
        fileIds: fileIds.length ? (fileIds as never) : undefined,
      });
      const next: Record<string, FieldState> = { ...fields };
      for (const f of tpl.fields) {
        const p = proposals.find((x) => x.fieldId === f.id);
        if (p && p.found && p.value !== "") {
          next[f.id] = {
            value: f.kind === "check" ? p.value === "true" : p.value,
            provenance: "ai",
            quote: p.quote,
            accepted: true,
          };
        }
      }
      setFields(ensureAllFields(next, tpl));
      setStep("form");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  // ── Manual / prefill ──────────────────────────────────────────────────
  const startManual = () => {
    if (!tpl) return;
    const next = ensureAllFields({ ...fields }, tpl);
    if (tpl.id === "meddic_snapshot") {
      const history = meddicHistory(deal.events, asOf);
      const prev = history[history.length - 1];
      if (prev) {
        for (const f of tpl.fields) {
          const v = prev.payload[f.id];
          if (v !== undefined && v !== null && v !== "" && (next[f.id].value === "" || next[f.id].value === false)) {
            next[f.id] = { value: f.kind === "check" ? v === true : String(v), provenance: "manual", accepted: true };
          }
        }
      }
    }
    setFields(next);
    setStep("form");
  };

  // ── Guided interview result ───────────────────────────────────────────
  const onGuidedDone = (collected: Record<string, string>) => {
    if (!tpl) return;
    const next: Record<string, FieldState> = { ...fields };
    for (const f of tpl.fields) {
      const v = collected[f.id];
      if (v !== undefined && v !== "") {
        next[f.id] = {
          value: f.kind === "check" ? v === "true" : v,
          provenance: "ai",
          accepted: true,
        };
      }
    }
    setFields(ensureAllFields(next, tpl));
    setStep("form");
  };

  // ── Submit ────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!tpl) return;
    setBusy("Filing…");
    try {
      const payload: Record<string, unknown> = {};
      const provenance: Record<string, { kind: Provenance; quote?: string }> = {};
      const gates: string[] = [];
      for (const f of tpl.fields) {
        const fs = fields[f.id];
        if (!fs || !fs.accepted) continue;
        const v = fs.value;
        if (v === "" || v === undefined) continue;
        payload[f.id] = f.kind === "number" || f.kind === "currency" ? Number(v) : v;
        provenance[f.id] = { kind: fs.provenance, ...(fs.quote ? { quote: fs.quote } : {}) };
        if (f.satisfiesGate && (f.kind === "check" ? v === true : String(v).trim() !== "")) gates.push(f.satisfiesGate);
      }
      await appendEvent({
        dealId: deal._id as never,
        at: asOf,
        author,
        discipline: tpl.discipline,
        type: "template",
        templateId: tpl.id,
        payload,
        gatesSatisfied: gates.length ? gates : undefined,
        provenance,
        evidenceText: evidenceText.trim() || undefined,
        attachments: uploaded.length
          ? uploaded.map((u) => ({ storageId: u.id, name: u.name, mime: u.mime }))
          : undefined,
      });
      onClose();
    } finally {
      setBusy(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  const backFromMode = () => (preselect || available.length === 1 ? onClose() : setTpl(null));

  return (
    <>
      <div className="scrim modal-scrim" onClick={onClose} />
      <div className={"modal" + (step === "guided" && tpl ? " wide" : "")}>
        <h3>File an update · {deal.account}</h3>

        {!tpl ? (
          <>
            <p className="modal-sub">Pick the record to file at this stage. To park or lose the deal, use the ··· menu on the deal instead.</p>
            <div className="tpl-pick">
              {available.map((t) => (
                <button key={t.id} className="tpl-option" onClick={() => { setTpl(t); setStep("mode"); }}>
                  <b>{t.name}</b>
                  <span className="pill blue">{t.discipline}</span>
                  <span className="tpl-desc">{t.description}</span>
                </button>
              ))}
            </div>
          </>
        ) : step === "mode" ? (
          <>
            <p className="modal-sub"><b>{tpl.name}</b> · {tpl.discipline}. How do you want to fill it in?</p>
            <div className="mode-cards">
              <button className="mode-card" onClick={() => setStep("guided")}>
                <span className="mode-icon">✦</span>
                <b>Guided interview</b>
                <span>Talk to the most experienced person for this gate. Grouped questions, voice or typing, follows up on what's missing.</span>
              </button>
              <button className="mode-card" onClick={() => setStep("evidence")}>
                <span className="mode-icon">📎</span>
                <b>Drop evidence</b>
                <span>Paste notes, upload a file or record one voice memo. The AI extracts the fields, you confirm.</span>
              </button>
              <button className="mode-card quiet" onClick={startManual}>
                <span className="mode-icon">✍</span>
                <b>Fill manually</b>
                <span>The classic form{tpl.id === "meddic_snapshot" ? ", pre-filled from the previous snapshot" : ""}.</span>
              </button>
            </div>
            <footer className="modal-foot">
              <button className="btn quiet" onClick={backFromMode}>Back</button>
            </footer>
          </>
        ) : step === "guided" ? (
          <GuidedChat row={row} templateId={tpl.id} asOf={asOf} onDone={onGuidedDone} onBack={() => setStep("mode")} />
        ) : step === "evidence" ? (
          <>
            <p className="modal-sub">
              Drop in your raw notes, a document or a voice memo — the AI fills the fields against this stage's requirements, you confirm.
            </p>
            <div className="cover-list">
              <span className="faint" style={{ fontSize: 11.5 }}>Cover these in your note or memo:</span>
              {tpl.fields.filter((f) => f.kind !== "check").slice(0, 10).map((f) => (
                <span key={f.id} className={"pill " + (f.satisfiesGate ? "blue" : "outline")}>
                  {(f.group ? f.group.split("—")[0].trim() + ": " : "") + f.label}
                </span>
              ))}
            </div>
            <div className="evidence">
              <textarea
                placeholder="Paste call notes, an email thread, bullets — anything…"
                value={evidenceText}
                onChange={(e) => setEvidenceText(e.target.value)}
              />
              <div className="evidence-actions">
                <label className="btn tiny">
                  📎 Add file
                  <input
                    type="file" multiple hidden
                    accept=".pdf,.txt,.md,.csv,.png,.jpg,.jpeg,audio/*"
                    onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])])}
                  />
                </label>
                <button className={"btn tiny" + (recording ? " danger rec-on" : "")} onClick={toggleRecording}>
                  {recording ? "■ Stop recording" : "🎙 Voice memo"}
                </button>
                <span className="spacer" style={{ flex: 1 }} />
                <span className="faint" style={{ fontSize: 11 }}>PDF · image · audio · text</span>
              </div>
              {files.length > 0 && (
                <div className="evidence-files">
                  {files.map((f, i) => (
                    <span key={i} className="pill violet">
                      {f.name}
                      <button className="btn quiet tiny" style={{ padding: "0 3px" }} onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            {error && <p style={{ color: "var(--red)", fontSize: 12 }}>{error}</p>}
            <footer className="modal-foot">
              <button className="btn quiet" onClick={() => setStep("mode")} disabled={!!busy}>← Mode</button>
              <span className="spacer" />
              <button
                className="btn ai"
                onClick={runExtract}
                disabled={!!busy || (!evidenceText.trim() && files.length === 0)}
              >
                {busy ?? "✦ Extract with AI"}
              </button>
            </footer>
          </>
        ) : (
          <>
            <p className="modal-sub">
              Review and confirm. <span className="pill violet">✦ AI</span> values came from your evidence or the interview — edit or reject anything. Fields marked ⛩ satisfy an exit gate.
            </p>
            <FormFields tpl={tpl} fields={fields} setField={setField} />
            {error && <p style={{ color: "var(--red)", fontSize: 12 }}>{error}</p>}
            <footer className="modal-foot">
              <button className="btn quiet" onClick={() => setStep("mode")} disabled={!!busy}>← Mode</button>
              <div className="filed-by">
                <span className="muted" style={{ fontSize: 12 }}>Filed by</span>
                <select value={author} onChange={(e) => setAuthor(e.target.value)}>
                  {authorOptions(user.name).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <span className="spacer" />
              <button className="btn primary" onClick={submit} disabled={!!busy}>{busy ?? "File record"}</button>
            </footer>
          </>
        )}
      </div>
    </>
  );
}

function FormFields({
  tpl, fields, setField,
}: {
  tpl: Template;
  fields: Record<string, FieldState>;
  setField: (id: string, patch: Partial<FieldState>) => void;
}) {
  let lastGroup: string | undefined;
  return (
    <div className="props">
      {tpl.fields.map((f) => {
        const head = f.group !== lastGroup ? f.group : undefined;
        lastGroup = f.group;
        const fs = fields[f.id] ?? { value: f.kind === "check" ? false : "", provenance: "manual" as Provenance, accepted: true };
        return (
          <div key={f.id}>
            {head && <div className="group-head">{head}</div>}
            <FieldRow field={f} fs={fs} setField={setField} />
          </div>
        );
      })}
    </div>
  );
}

function FieldRow({ field, fs, setField }: { field: TemplateField; fs: FieldState; setField: (id: string, patch: Partial<FieldState>) => void }) {
  const onChange = (v: string | boolean) =>
    setField(field.id, { value: v, provenance: fs.provenance === "ai" ? "ai-edited" : fs.provenance });
  return (
    <div className={"prop" + (fs.accepted ? "" : " rejected")}>
      <div className="prop-head">
        <span className="prop-label">
          {field.label}
          {field.satisfiesGate && " ⛩"}
        </span>
        {fs.provenance !== "manual" && <span className="pill violet">✦ AI{fs.provenance === "ai-edited" ? " · edited" : ""}</span>}
        {fs.provenance !== "manual" && (
          <button className="btn quiet tiny" onClick={() => setField(field.id, { accepted: !fs.accepted })}>
            {fs.accepted ? "Reject" : "Restore"}
          </button>
        )}
      </div>
      {field.kind === "check" ? (
        <label className="f-check">
          <input type="checkbox" checked={fs.value === true} onChange={(e) => onChange(e.target.checked)} />
          <span className="muted" style={{ fontSize: 12 }}>{field.hint ?? "Confirmed"}</span>
        </label>
      ) : field.kind === "select" ? (
        <select value={String(fs.value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.kind === "longtext" ? (
        <textarea rows={2} value={String(fs.value)} placeholder={field.hint} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          type={field.kind === "date" ? "date" : field.kind === "number" || field.kind === "currency" ? "number" : "text"}
          value={String(fs.value)}
          placeholder={field.hint}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {fs.quote && <span className="prop-quote">“{fs.quote}”</span>}
    </div>
  );
}

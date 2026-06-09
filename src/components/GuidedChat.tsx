import { useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TEMPLATE_BY_ID, STAGE_BY_ID } from "../../convex/pipeline";
import type { DealRow } from "../App";

interface Msg {
  role: "user" | "model";
  text: string;
}

interface Props {
  row: DealRow;
  templateId: string;
  onDone: (collected: Record<string, string>) => void;
  onBack: () => void;
}

// The guided interview: a chat with "the most experienced person for this
// gate". Typed or spoken answers; fields and gates light up as they are
// collected; finishing hands the values to the review form.
export function GuidedChat({ row, templateId, onDone, onBack }: Props) {
  const { deal, state } = row;
  const template = TEMPLATE_BY_ID[templateId];
  const stage = STAGE_BY_ID[state.stageId];
  const step = useAction(api.guide.step);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [collected, setCollected] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const dealContext = (() => {
    const unmet = stage.exitGates.filter((g) => !state.gates[g.id]).map((g) => g.label);
    const prior = deal.events
      .filter((e) => e.type === "template" && e.templateId === templateId && e.payload)
      .slice(-1)[0];
    const bits: string[] = [];
    if (unmet.length) bits.push(`Unmet exit gates for ${stage.name}: ${unmet.join("; ")}.`);
    if (prior) bits.push(`Previous ${template.name} (${prior.at}): ${JSON.stringify(prior.payload).slice(0, 800)}`);
    if (state.blocker) bits.push(`Current blocker: ${state.blocker}`);
    return bits.join("\n");
  })();

  const scroll = () => setTimeout(() => bodyRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 60);

  const runStep = async (opts: { userText?: string; audioFileId?: string; finish?: boolean }) => {
    setBusy(true);
    setError(null);
    try {
      const turn = await step({
        templateId,
        stageId: state.stageId,
        account: `${deal.account} · ${deal.site}`,
        history: msgs.map((m) => ({ role: m.role, text: m.text })),
        userText: opts.userText,
        audioFileId: opts.audioFileId as never,
        dealContext,
        collected,
        finish: opts.finish,
      });
      const newMsgs: Msg[] = [...msgs];
      if (opts.userText) newMsgs.push({ role: "user", text: opts.userText });
      else if (turn.transcript) newMsgs.push({ role: "user", text: `🎙 ${turn.transcript}` });
      else if (opts.audioFileId) newMsgs.push({ role: "user", text: "🎙 (voice answer)" });
      newMsgs.push({ role: "model", text: turn.reply });
      setMsgs(newMsgs);
      const merged = { ...collected, ...turn.collected };
      setCollected(merged);
      scroll();
      if (turn.done) onDone(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void runStep({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = () => {
    if (!input.trim() || busy) return;
    const text = input.trim();
    setInput("");
    void runStep({ userText: text });
  };

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
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        try {
          const url = await generateUploadUrl({});
          const res = await fetch(url, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
          const { storageId } = (await res.json()) as { storageId: string };
          await runStep({ audioFileId: storageId });
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setError("Microphone not available.");
    }
  };

  const total = template.fields.length;
  const got = template.fields.filter((f) => collected[f.id] !== undefined).length;
  const gateFields = template.fields.filter((f) => f.satisfiesGate);

  return (
    <div className="guided">
      <div className="guided-progress">
        <div className="gauge"><div className="gauge-fill" style={{ width: total ? (got / total) * 100 + "%" : "0%" }} /></div>
        <span className="mono faint" style={{ fontSize: 11 }}>{got}/{total} fields</span>
        {gateFields.map((f) => (
          <span key={f.id} className={"pill " + (collected[f.id] !== undefined ? "green" : "outline")} title={f.label}>
            ⛩ {f.satisfiesGate}
          </span>
        ))}
      </div>

      <div className="guided-body" ref={bodyRef}>
        {msgs.map((m, i) => (
          <div key={i} className={"msg " + (m.role === "user" ? "user" : "ai")}>
            <pre>{m.text}</pre>
          </div>
        ))}
        {busy && <div className="msg thinking">{recording ? "" : "thinking…"}</div>}
        {error && <p style={{ color: "var(--red)", fontSize: 12 }}>{error}</p>}
      </div>

      <div className="guided-foot">
        <button className={"btn tiny" + (recording ? " danger rec-on" : "")} onClick={toggleRecording} disabled={busy && !recording} title="Answer by voice">
          {recording ? "■ Stop" : "🎙"}
        </button>
        <input
          value={input}
          placeholder={recording ? "Recording… press ■ when done" : "Type your answer… (or skip / don't know)"}
          disabled={busy || recording}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="btn primary" onClick={send} disabled={busy || recording || !input.trim()}>→</button>
      </div>

      <footer className="modal-foot">
        <button className="btn quiet" onClick={onBack} disabled={busy}>← Mode</button>
        <span className="spacer" />
        <button className="btn" onClick={() => runStep({ finish: true })} disabled={busy || got === 0}>
          Finish & review ({got} fields)
        </button>
      </footer>
    </div>
  );
}

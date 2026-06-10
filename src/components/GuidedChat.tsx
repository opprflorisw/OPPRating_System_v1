import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TEMPLATE_BY_ID, TEMPLATES, STAGE_BY_ID, nextStageId } from "../../convex/pipeline";
import { gateLedger } from "../../convex/derive";
import { Md } from "./Markdown";
import type { DealRow } from "../App";

interface Msg {
  role: "user" | "model";
  text: string;
}

interface Props {
  row: DealRow;
  templateId: string;
  asOf: string;
  onDone: (collected: Record<string, string>, transcript?: string) => void;
  onBack: () => void;
}

// The guided interview: a chat with "the most experienced person for this
// gate". Typed or spoken answers; fields and gates light up as they are
// collected; finishing hands the values to the review form.
export function GuidedChat({ row, templateId, asOf, onDone, onBack }: Props) {
  const { deal, state } = row;
  const template = TEMPLATE_BY_ID[templateId];
  const stage = STAGE_BY_ID[state.stageId];
  const step = useAction(api.guide.step);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  // Per-field truth BEFORE the interview starts: which gate-fields are already
  // satisfied (by ANY earlier filing), with the value that satisfied them.
  // This is what stops the interviewer re-asking green gates.
  const fieldStatus = useMemo(() => {
    const ledger = gateLedger(deal.events, asOf);
    const prior = deal.events
      .filter((e) => e.type === "template" && e.templateId === templateId && e.payload)
      .slice(-1)[0]?.payload as Record<string, unknown> | undefined;
    return template.fields.map((f) => {
      const gateId = f.satisfiesGate;
      const gateMet = gateId ? Boolean(state.gates[gateId]) : false;
      const lastEntry = gateId ? ledger[gateId]?.slice(-1)[0] : undefined;
      const priorValue = prior?.[f.id];
      return {
        field: f,
        gateMet,
        currentValue: lastEntry?.value ?? (priorValue !== undefined && priorValue !== "" ? String(priorValue) : undefined),
        satisfiedAt: gateId ? state.gates[gateId]?.at : undefined,
      };
    });
  }, [deal.events, asOf, templateId, template.fields, state.gates]);

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
    const bits: string[] = [];
    const satisfied = fieldStatus.filter((fs) => fs.gateMet);
    const missingGateFields = fieldStatus.filter((fs) => fs.field.satisfiesGate && !fs.gateMet);
    const known = fieldStatus.filter((fs) => !fs.field.satisfiesGate && fs.currentValue);
    const gateOf = (fs: (typeof fieldStatus)[number]) => stage.exitGates.find((g) => g.id === fs.field.satisfiesGate);
    if (satisfied.length) {
      bits.push(
        `ALREADY ON FILE — these gates are ALREADY SATISFIED, do NOT ask about them again:\n` +
          satisfied
            .map((fs) => `- (${gateOf(fs)?.code}) ${fs.field.label} [met ${fs.satisfiedAt ?? ""}]: ${String(fs.currentValue ?? "confirmed").slice(0, 200)}`)
            .join("\n")
      );
    }
    if (missingGateFields.length) {
      bits.push(
        `STILL MISSING — these numbered gates are what this interview must fill:\n` +
          missingGateFields.map((fs) => `- (${gateOf(fs)?.code}) ${gateOf(fs)?.label ?? fs.field.label}`).join("\n")
      );
    } else {
      const next = nextStageId(state.stageId);
      const allMet = stage.exitGates.every((g) => state.gates[g.id]);
      if (allMet && next) {
        bits.push(
          `ALL EXIT GATES FOR ${stage.name.toUpperCase()} ARE MET. This interview is for updates/refreshes only. ` +
            `Tell the user up front that the stage is complete and they can advance to ${STAGE_BY_ID[next].name}; only collect what they volunteer as new.`
        );
      }
    }
    if (known.length) {
      bits.push(`Known non-gate values (confirm only if relevant):\n` + known.map((fs) => `- ${fs.field.label}: ${String(fs.currentValue).slice(0, 150)}`).join("\n"));
    }
    if (state.blocker) bits.push(`Current blocker: ${state.blocker}`);
    bits.push(`Days in stage: ${state.daysInStage}.`);
    return bits.join("\n\n");
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
        clientId: deal.clientId as never,
        workspace: deal.workspace ?? "sim",
        asOf,
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
      if (turn.done) {
        const transcript = newMsgs
          .map((m) => (m.role === "user" ? "User: " : "Coach: ") + m.text)
          .join("\n\n");
        onDone(merged, transcript);
      }
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

  // Progress measured against the STAGE's gates — the same ruler as the
  // board and the record card, so the numbers always match.
  const stageGates = stage.exitGates.map((g) => {
    const met = Boolean(state.gates[g.id]);
    const fillField = template.fields.find((f) => f.satisfiesGate === g.id);
    const captured = !met && fillField ? collected[fillField.id] !== undefined : false;
    const otherTpl = !fillField
      ? TEMPLATES.find((t) => t.id !== template.id && t.stages.includes(state.stageId) && t.fields.some((f) => f.satisfiesGate === g.id))
      : undefined;
    return { gate: g, met, captured, fillableHere: Boolean(fillField), otherTpl };
  });
  const metCount = stageGates.filter((x) => x.met).length;
  const capturedCount = stageGates.filter((x) => x.captured).length;
  const answers = template.fields.filter((f) => collected[f.id] !== undefined).length;
  const short = (s: string) => (s.length > 34 ? s.slice(0, 33) + "…" : s);

  return (
    <div className="guided">
      <div className="guided-progress">
        <div className="gauge">
          <div className="gauge-fill" style={{ width: stageGates.length ? ((metCount + capturedCount) / stageGates.length) * 100 + "%" : "0%" }} />
        </div>
        <span className="mono faint" style={{ fontSize: 11 }}>
          {metCount + capturedCount}/{stageGates.length} {stage.name} gates · {answers} answer{answers === 1 ? "" : "s"} this session
        </span>
      </div>
      <div className="guided-gates">
        {stageGates.map(({ gate, met, captured, fillableHere, otherTpl }) => {
          const cls = met ? "done-before" : captured ? "captured" : fillableHere ? "open" : "elsewhere";
          const title = met
            ? `${gate.code} · already satisfied`
            : fillableHere
              ? `${gate.code} · ${gate.label}`
              : `${gate.code} · filled via ${otherTpl?.name ?? "another template"}`;
          return (
            <span key={gate.id} className={"gate-chip " + cls} title={title}>
              <b className="mono">{gate.code}</b> {met ? "✓" : captured ? "✦" : "○"} {short(gate.label)}
            </span>
          );
        })}
      </div>

      <div className="guided-body" ref={bodyRef}>
        {msgs.map((m, i) => (
          <div key={i} className={"msg " + (m.role === "user" ? "user" : "ai")}>
            {m.role === "model" ? <Md text={m.text} /> : <pre>{m.text}</pre>}
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
        <button className="btn" onClick={() => runStep({ finish: true })} disabled={busy || answers === 0}>
          Finish & review ({answers} answer{answers === 1 ? "" : "s"})
        </button>
      </footer>
    </div>
  );
}

import { useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

interface Msg {
  role: "user" | "ai";
  text: string;
}

const SUGGESTIONS = [
  "Which deals need my attention this week and why?",
  "Where are we leaking time in the funnel?",
  "Which economic buyers are not engaged yet?",
  "Summarise the Attero Wijster record for a handover.",
];

export function ChatDock({ asOf }: { asOf: string }) {
  const ask = useAction(api.chat.ask);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const send = async (q: string) => {
    if (!q.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const answer = await ask({ question: q, asOf });
      setMsgs((m) => [...m, { role: "ai", text: answer }]);
      setTimeout(() => bodyRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 50);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className={"chat-fab" + (open ? " open" : "")} onClick={() => setOpen(!open)}>
        {open ? "CLOSE ✕" : "ASK THE DATA"}
      </button>
      {open && (
        <div className="chat">
          <header className="chat-head">
            <b>Ask the data</b>
            <span className="mono">as of {asOf} · Gemini</span>
          </header>
          <div className="chat-body" ref={bodyRef}>
            {msgs.length === 0 && (
              <div className="chat-sugs">
                <p className="muted">The RevOps analyst reads every deal record. Try:</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chat-sug" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={"msg " + m.role}>
                <pre>{m.text}</pre>
              </div>
            ))}
            {busy && <div className="msg ai thinking">analysing the records…</div>}
          </div>
          <footer className="chat-foot">
            <input
              value={input}
              placeholder="Ask about deals, gates, blockers…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              disabled={busy}
            />
            <button className="btn on" onClick={() => send(input)} disabled={busy}>→</button>
          </footer>
        </div>
      )}
    </>
  );
}

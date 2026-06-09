import { useState } from "react";
import { STAGES, TEMPLATES } from "../../convex/pipeline";
import {
  EMAIL_TEMPLATES, INFO_REQUEST_LIST, SITE_VISIT_AGENDA,
  THREE_WHYS, VALUE_HYPOTHESIS, MEDDIC_RUBRIC, MEDDIC_STANDARD_NOTES, PRINCIPLES,
} from "../../convex/library";

type Tab = "pipeline" | "templates" | "meddic" | "frameworks" | "emails";

export function Library() {
  const [tab, setTab] = useState<Tab>("pipeline");
  return (
    <main className="page">
      <div className="page-head">
        <h2>Library</h2>
        <span className="muted">Every commercial standard in one place — from the operating manual and the workshop with Lars.</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {(
          [
            ["pipeline", "Pipeline & gates"],
            ["templates", "Filing templates"],
            ["meddic", "MEDDIC standard"],
            ["frameworks", "3Ys & Value Hypothesis"],
            ["emails", "Emails & meetings"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} className={"btn" + (tab === id ? " primary" : " quiet")} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "pipeline" && (
        <>
          <div className="panel">
            <h4>Principles</h4>
            <ul className="lib-list">{PRINCIPLES.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </div>
          {STAGES.map((s) => (
            <div className="panel" key={s.id}>
              <h4>
                {s.name}
                <span className="pill">{s.probability}% · {s.forecastCategory}</span>
                {s.checkpoint && <span className="pill violet">{s.checkpoint.id} — {s.checkpoint.label}</span>}
              </h4>
              <p className="muted" style={{ margin: "0 0 8px", fontSize: 12.5 }}>{s.purpose}</p>
              {s.exitGates.length > 0 && (
                <ul className="lib-list">
                  {s.exitGates.map((g) => (
                    <li key={g.id}>{g.label}{g.cp && <em className="cp-mini"> {g.cp}</em>}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </>
      )}

      {tab === "templates" && (
        <div className="lib-grid">
          {TEMPLATES.map((t) => (
            <div className="panel" key={t.id} style={{ margin: 0 }}>
              <h4>{t.name} <span className="pill blue">{t.discipline}</span></h4>
              <p className="muted" style={{ margin: "0 0 8px", fontSize: 12.5 }}>{t.description}</p>
              <ul className="lib-list">
                {t.fields.map((f) => (
                  <li key={f.id}>
                    {(f.group ? f.group + " · " : "") + f.label}
                    {f.satisfiesGate && <span className="pill green" style={{ marginLeft: 6 }}>⛩ gate</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === "meddic" && (
        <>
          <div className="panel">
            <h4>How MEDDIC works here</h4>
            <ul className="lib-list">{MEDDIC_STANDARD_NOTES.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </div>
          <div className="panel">
            <h4>Scoring rubric — what 1 / 3 / 5 means</h4>
            <table className="table" style={{ border: "none" }}>
              <thead><tr><th>Letter</th><th>1–2</th><th>3</th><th>4–5</th></tr></thead>
              <tbody>
                {MEDDIC_RUBRIC.map((r) => (
                  <tr key={r.key + r.label}>
                    <td><b>{r.letter}</b> <span className="faint">{r.label}</span></td>
                    <td style={{ fontSize: 12 }}>{r.low}</td>
                    <td style={{ fontSize: 12 }}>{r.mid}</td>
                    <td style={{ fontSize: 12 }}>{r.high}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "frameworks" && (
        <>
          <div className="panel">
            <h4>{THREE_WHYS.title}</h4>
            <p className="muted" style={{ margin: "0 0 10px", fontSize: 12.5 }}>{THREE_WHYS.description}</p>
            <div className="panel alert-gray" style={{ margin: "0 0 10px" }}><b style={{ fontSize: 12.5 }}>{THREE_WHYS.header}</b></div>
            <div className="grid3">
              {THREE_WHYS.columns.map((c) => (
                <div className="cell" key={c.why}>
                  <h6>{c.why}</h6>
                  {c.rows.map((r) => <div key={r} style={{ padding: "2px 0" }}>{r}</div>)}
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <h4>{VALUE_HYPOTHESIS.title}</h4>
            <p className="muted" style={{ margin: "0 0 10px", fontSize: 12.5 }}>{VALUE_HYPOTHESIS.description}</p>
            {VALUE_HYPOTHESIS.rows.map((r) => (
              <div className="vh-row" key={r.label}>
                <span className="lbl">{r.label}</span>
                <span className="guide">{r.guide}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "emails" && (
        <>
          {EMAIL_TEMPLATES.map((e) => (
            <div className="panel" key={e.id}>
              <h4>{e.name} <span className="pill">{e.when}</span></h4>
              <p style={{ margin: "0 0 8px", fontSize: 12.5 }}><b>Subject:</b> {e.subject}</p>
              <pre className="email-body">{e.body}</pre>
              <ul className="lib-list" style={{ marginTop: 8 }}>{e.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          ))}
          <div className="lib-grid">
            <div className="panel" style={{ margin: 0 }}>
              <h4>Info to request — personalise the demo</h4>
              <p style={{ margin: 0 }}>
                {INFO_REQUEST_LIST.map((i) => <span key={i} className="pill outline" style={{ marginRight: 6, marginBottom: 6 }}>{i}</span>)}
              </p>
            </div>
            <div className="panel" style={{ margin: 0 }}>
              <h4>Site-visit agenda (~1 hour)</h4>
              <ol className="lib-list">{SITE_VISIT_AGENDA.map((a, i) => <li key={i}>{a}</li>)}</ol>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

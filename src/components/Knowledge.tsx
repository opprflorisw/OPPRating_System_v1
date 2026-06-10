import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { NODE_TYPES, NODE_COLOR, NODE_LABEL, SCOPE_LABEL, isStale, daysBetweenISO } from "../../convex/knowledgeModel";

interface KNode {
  _id: string;
  type: string;
  title: string;
  claim: string;
  detail?: string;
  confidence: number;
  status: string;
  source: string;
  scopeLevel: string;
  vertical?: string;
  clientId?: string;
  lastConfirmedAt: string;
  createdAt: string;
  tags?: string[];
  provenance?: { quote?: string; dealId?: string; eventId?: string }[];
}
interface KEdge { _id: string; source: string; target: string; type: string }
interface Client { _id: string; name: string; vertical: string }

type Lens = { kind: "general" } | { kind: "vertical"; vertical: string } | { kind: "client"; clientId: string };

const W = 720;
const H = 560;

// Deterministic force layout — runs a fixed number of iterations in a memo.
function layout(nodes: KNode[], edges: KEdge[]): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number; vx: number; vy: number }>();
  const n = nodes.length;
  if (n === 0) return new Map();
  nodes.forEach((node, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = 60 + ((i * 53) % 100) * 1.4;
    pos.set(node._id, { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r, vx: 0, vy: 0 });
  });
  const idset = new Set(nodes.map((x) => x._id));
  const es = edges.filter((e) => idset.has(e.source) && idset.has(e.target));
  const deg = new Map<string, number>();
  for (const e of es) {
    deg.set(e.source, (deg.get(e.source) ?? 0) + 1);
    deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
  }
  const iters = n > 140 ? 160 : 240;
  const k = 5200; // repulsion
  const spring = 0.02;
  const ideal = 90;
  for (let it = 0; it < iters; it++) {
    const damp = 0.85;
    for (let i = 0; i < n; i++) {
      const a = pos.get(nodes[i]._id)!;
      for (let j = i + 1; j < n; j++) {
        const b = pos.get(nodes[j]._id)!;
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { d2 = 0.01; dx = (i - j) * 0.1; dy = 0.1; }
        const f = k / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
    }
    for (const e of es) {
      const a = pos.get(e.source)!, b = pos.get(e.target)!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - ideal) * spring;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
    for (const node of nodes) {
      const p = pos.get(node._id)!;
      p.vx += (W / 2 - p.x) * 0.006;
      p.vy += (H / 2 - p.y) * 0.006;
      p.x += Math.max(-12, Math.min(12, p.vx * damp));
      p.y += Math.max(-12, Math.min(12, p.vy * damp));
      p.vx *= damp; p.vy *= damp;
      p.x = Math.max(24, Math.min(W - 24, p.x));
      p.y = Math.max(24, Math.min(H - 24, p.y));
    }
  }
  const out = new Map<string, { x: number; y: number }>();
  pos.forEach((p, id) => out.set(id, { x: p.x, y: p.y }));
  return out;
}

export function Knowledge({
  workspace,
  asOf,
  focusNodeId,
  onClearFocus,
}: {
  workspace: string;
  asOf: string;
  focusNodeId?: string | null;
  onClearFocus?: () => void;
}) {
  const data = useQuery(api.knowledge.graph, { workspace }) as
    | { nodes: KNode[]; edges: KEdge[]; clients: Client[]; verticals: { vid: string; name: string }[] }
    | undefined;
  const proposals = useQuery(api.knowledge.proposed, { workspace }) as
    | { node: KNode; sources: { type: string; node: KNode }[] }[]
    | undefined;
  const approve = useMutation(api.knowledge.approve);
  const reject = useMutation(api.knowledge.reject);
  const setup = useMutation(api.knowledgeSeed.setup);
  const scan = useAction(api.knowledgePromote.scan);

  const [lens, setLens] = useState<Lens>({ kind: "general" });
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [tab, setTab] = useState<"graph" | "review">("graph");
  const [busy, setBusy] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // A knowledge: link selected a node — focus its tier and open it.
  useEffect(() => {
    if (!focusNodeId || !data) return;
    const node = data.nodes.find((n) => n._id === focusNodeId);
    if (node) {
      if (node.scopeLevel === "client" && node.clientId) setLens({ kind: "client", clientId: node.clientId });
      else if (node.scopeLevel === "vertical" && node.vertical) setLens({ kind: "vertical", vertical: node.vertical });
      else setLens({ kind: "general" });
      setSelected(node._id);
      setTab("graph");
    }
  }, [focusNodeId, data]);

  const visibleNodes = useMemo(() => {
    if (!data) return [];
    return data.nodes.filter((n) => {
      if (n.status === "rejected") return false;
      if (lens.kind === "general") return n.scopeLevel === "general";
      if (lens.kind === "vertical") return n.scopeLevel === "vertical" && n.vertical === lens.vertical;
      return n.scopeLevel === "client" && n.clientId === lens.clientId;
    });
  }, [data, lens]);

  const visibleEdges = useMemo(() => {
    if (!data) return [];
    const idset = new Set(visibleNodes.map((n) => n._id));
    return data.edges.filter((e) => idset.has(e.source) && idset.has(e.target));
  }, [data, visibleNodes]);

  const pos = useMemo(() => layout(visibleNodes, visibleEdges), [visibleNodes, visibleEdges]);
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const e of visibleEdges) {
      d.set(e.source, (d.get(e.source) ?? 0) + 1);
      d.set(e.target, (d.get(e.target) ?? 0) + 1);
    }
    return d;
  }, [visibleEdges]);

  const selectedNode = visibleNodes.find((n) => n._id === selected) ?? null;
  const neighborIds = useMemo(() => {
    if (!selected) return new Set<string>();
    const s = new Set<string>();
    for (const e of visibleEdges) {
      if (e.source === selected) s.add(e.target);
      if (e.target === selected) s.add(e.source);
    }
    return s;
  }, [selected, visibleEdges]);

  if (data === undefined) return <main className="page"><div className="empty">Loading the knowledge graph…</div></main>;

  const totalNodes = data.nodes.length;
  if (totalNodes === 0) {
    return (
      <main className="page">
        <div className="page-head"><h2>Knowledge</h2></div>
        <div className="empty">
          <div className="onboard">
            <h3>The knowledge graph is empty.</h3>
            <p>Seed the methodology tier from the operating manual and the demo client/vertical graph, then file updates to watch it grow.</p>
            <button className="btn primary" disabled={!!busy} onClick={async () => {
              setBusy("Setting up…");
              try { await setup({ workspace }); } finally { setBusy(null); }
            }}>{busy ?? "Initialize knowledge system"}</button>
          </div>
        </div>
      </main>
    );
  }

  const pendingCount = proposals?.length ?? 0;

  return (
    <main className="page knowledge-page">
      <div className="page-head">
        <h2>Knowledge</h2>
        <span className="muted">
          Three tiers feed the AI by context: <b>general</b> method, the <b>vertical</b>, and each <b>client</b>. Client facts are learned automatically from filings; vertical/general lessons are promoted on review.
        </span>
      </div>

      <div className="k-tabs">
        <button className={"k-tab" + (tab === "graph" ? " active" : "")} onClick={() => setTab("graph")}>Graph</button>
        <button className={"k-tab" + (tab === "review" ? " active" : "")} onClick={() => setTab("review")}>
          Review queue{pendingCount ? <span className="k-badge">{pendingCount}</span> : null}
        </button>
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn ai tiny" disabled={!!busy} onClick={async () => {
          setBusy("Scanning…"); setScanResult(null);
          try {
            const r = await scan({ workspace, vertical: lens.kind === "vertical" ? lens.vertical : "waste" });
            setScanResult(`${r.vertical} vertical + ${r.general} general proposal(s). See the review queue.`);
            setTab("review");
          } finally { setBusy(null); }
        }}>{busy === "Scanning…" ? "Scanning…" : "✦ Scan for lessons now"}</button>
      </div>
      {scanResult && <p className="muted" style={{ fontSize: 12 }}>{scanResult}</p>}

      {tab === "graph" ? (
        <>
          <div className="k-lens">
            <button className={"k-lens-btn" + (lens.kind === "general" ? " active" : "")} onClick={() => { setLens({ kind: "general" }); setSelected(null); }}>
              {SCOPE_LABEL.general}
            </button>
            {data.verticals.map((vrt) => (
              <button key={vrt.vid}
                className={"k-lens-btn" + (lens.kind === "vertical" && lens.vertical === vrt.vid ? " active" : "")}
                onClick={() => { setLens({ kind: "vertical", vertical: vrt.vid }); setSelected(null); }}>
                {vrt.name}
              </button>
            ))}
            <select
              className="k-client-select"
              value={lens.kind === "client" ? lens.clientId : ""}
              onChange={(e) => { if (e.target.value) { setLens({ kind: "client", clientId: e.target.value }); setSelected(null); } }}
            >
              <option value="">Client…</option>
              {data.clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>

          <div className="k-graph-wrap">
            <svg
              className="k-graph"
              viewBox={`0 0 ${W} ${H}`}
              onWheel={(e) => {
                const ns = Math.max(0.4, Math.min(2.5, view.s * (e.deltaY < 0 ? 1.1 : 0.9)));
                setView((v) => ({ ...v, s: ns }));
              }}
              onMouseDown={(e) => { dragRef.current = { x: e.clientX, y: e.clientY, ox: view.x, oy: view.y }; }}
              onMouseMove={(e) => {
                if (!dragRef.current) return;
                setView((v) => ({ ...v, x: dragRef.current!.ox + (e.clientX - dragRef.current!.x), y: dragRef.current!.oy + (e.clientY - dragRef.current!.y) }));
              }}
              onMouseUp={() => { dragRef.current = null; }}
              onMouseLeave={() => { dragRef.current = null; }}
              onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
            >
              <g transform={`translate(${view.x} ${view.y}) scale(${view.s})`}>
                {visibleEdges.map((e) => {
                  const a = pos.get(e.source), b = pos.get(e.target);
                  if (!a || !b) return null;
                  const active = selected && (e.source === selected || e.target === selected);
                  const dashed = e.type === "supersedes" || e.type === "generalized_from" || e.type === "refines";
                  return (
                    <line key={e._id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={active ? "#111" : "#cfcfca"} strokeWidth={active ? 1.6 : 1}
                      strokeDasharray={dashed ? "4 3" : undefined} opacity={selected && !active ? 0.25 : 0.8} />
                  );
                })}
                {visibleNodes.map((n) => {
                  const p = pos.get(n._id);
                  if (!p) return null;
                  const r = Math.min(16, 6 + (degree.get(n._id) ?? 0) * 1.6);
                  const isSel = selected === n._id;
                  const dim = selected && !isSel && !neighborIds.has(n._id);
                  const showLabel = isSel || hover === n._id || neighborIds.has(n._id);
                  const stale = isStale(n.lastConfirmedAt, asOf);
                  return (
                    <g key={n._id} transform={`translate(${p.x} ${p.y})`}
                      style={{ cursor: "pointer", opacity: dim ? 0.3 : 1 }}
                      onMouseEnter={() => setHover(n._id)} onMouseLeave={() => setHover(null)}
                      onClick={(ev) => { ev.stopPropagation(); setSelected(n._id); }}>
                      <circle r={r} fill={NODE_COLOR[n.type] ?? "#888"}
                        stroke={isSel ? "#111" : n.status === "proposed" ? "#d97706" : "#fff"}
                        strokeWidth={isSel ? 2.4 : n.status === "proposed" ? 2 : 1.4}
                        strokeDasharray={n.status === "proposed" ? "3 2" : undefined}
                        opacity={n.status === "superseded" ? 0.4 : 1} />
                      {stale && <circle r={r + 3} fill="none" stroke="#dc2626" strokeWidth={1} strokeDasharray="2 2" />}
                      {showLabel && (
                        <text x={r + 4} y={4} fontSize={11} fill="#18181a" style={{ pointerEvents: "none" }}>
                          {n.title.length > 30 ? n.title.slice(0, 29) + "…" : n.title}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>

            <aside className="k-inspector">
              {selectedNode ? (
                <NodeInspector node={selectedNode} edges={visibleEdges} nodes={visibleNodes} asOf={asOf} onSelect={setSelected} />
              ) : (
                <div className="k-legend">
                  <h4>{lens.kind === "client" ? data.clients.find((c) => c._id === (lens as any).clientId)?.name : lens.kind === "vertical" ? "Vertical lessons" : "General methodology"}</h4>
                  <p className="muted" style={{ fontSize: 12 }}>{visibleNodes.length} nodes · {visibleEdges.length} links. Click a node to inspect it; drag to pan, scroll to zoom.</p>
                  <div className="k-legend-items">
                    {NODE_TYPES.map((t) => (
                      <span key={t.type} className="k-legend-item">
                        <span className="k-dot" style={{ background: t.color }} /> {t.label}
                      </span>
                    ))}
                  </div>
                  <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
                    Dashed ring = unconfirmed 60+ days. Dashed amber outline = proposed (awaiting review). Faded = superseded.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </>
      ) : (
        <ReviewQueue proposals={proposals ?? []} busy={busy}
          onApprove={async (id, claim) => { setBusy("Approving…"); try { await approve({ nodeId: id as never, claim }); } finally { setBusy(null); } }}
          onReject={async (id) => { setBusy("Rejecting…"); try { await reject({ nodeId: id as never }); } finally { setBusy(null); } }}
        />
      )}
    </main>
  );
}

function NodeInspector({ node, edges, nodes, asOf, onSelect }: {
  node: KNode; edges: KEdge[]; nodes: KNode[]; asOf: string; onSelect: (id: string) => void;
}) {
  const byId = new Map(nodes.map((n) => [n._id, n]));
  const linked = edges
    .filter((e) => e.source === node._id || e.target === node._id)
    .map((e) => ({ type: e.type, other: byId.get(e.source === node._id ? e.target : e.source) }))
    .filter((x) => x.other);
  const age = daysBetweenISO(node.lastConfirmedAt, asOf);
  return (
    <div className="k-node">
      <div className="k-node-head">
        <span className="k-dot" style={{ background: NODE_COLOR[node.type] ?? "#888" }} />
        <b>{NODE_LABEL[node.type] ?? node.type}</b>
        <span className="spacer" style={{ flex: 1 }} />
        {node.status !== "active" && <span className={"pill " + (node.status === "proposed" ? "amber" : "outline")}>{node.status}</span>}
      </div>
      <p className="k-claim">{node.claim}</p>
      {node.detail && <p className="k-detail">{node.detail}</p>}
      <div className="k-meta">
        <span title="confidence">conf <b>{Math.round(node.confidence * 100)}%</b></span>
        <span>· source {node.source}</span>
        <span>· confirmed {age <= 0 ? "today" : age + "d ago"}{isStale(node.lastConfirmedAt, asOf) ? " ⚠" : ""}</span>
      </div>
      {node.tags && node.tags.length > 0 && (
        <div className="k-tags">{node.tags.map((t) => <span key={t} className="pill outline">{t}</span>)}</div>
      )}
      {node.provenance && node.provenance.some((p) => p.quote) && (
        <div className="k-prov">
          <h5>Evidence</h5>
          {node.provenance.filter((p) => p.quote).map((p, i) => <p key={i} className="k-quote">“{p.quote}”</p>)}
        </div>
      )}
      {linked.length > 0 && (
        <div className="k-links">
          <h5>Connected ({linked.length})</h5>
          {linked.map((l, i) => (
            <button key={i} className="k-link-row" onClick={() => onSelect(l.other!._id)}>
              <span className="k-dot" style={{ background: NODE_COLOR[l.other!.type] ?? "#888" }} />
              <span className="k-link-type">{l.type.replace(/_/g, " ")}</span>
              <span className="k-link-claim">{l.other!.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewQueue({ proposals, busy, onApprove, onReject }: {
  proposals: { node: KNode; sources: { type: string; node: KNode }[] }[];
  busy: string | null;
  onApprove: (id: string, claim?: string) => void;
  onReject: (id: string) => void;
}) {
  if (proposals.length === 0) {
    return <div className="empty"><p className="muted">No proposals waiting. Run a scan to roll client knowledge up into vertical/general lessons.</p></div>;
  }
  return (
    <div className="k-review">
      <p className="muted" style={{ fontSize: 12 }}>
        Proposed promotions — anonymized lessons generalized from client knowledge. Only <b>approved</b> nodes are served to the AI.
      </p>
      {proposals.map(({ node, sources }) => (
        <ReviewRow key={node._id} node={node} sources={sources} busy={busy} onApprove={onApprove} onReject={onReject} />
      ))}
    </div>
  );
}

function ReviewRow({ node, sources, busy, onApprove, onReject }: {
  node: KNode; sources: { type: string; node: KNode }[]; busy: string | null;
  onApprove: (id: string, claim?: string) => void; onReject: (id: string) => void;
}) {
  const [claim, setClaim] = useState(node.claim);
  const tier = node.scopeLevel === "general" ? "General" : "Vertical";
  return (
    <div className="k-review-row">
      <div className="k-review-head">
        <span className="k-dot" style={{ background: NODE_COLOR[node.type] ?? "#888" }} />
        <span className="pill amber">{tier} · {NODE_LABEL[node.type] ?? node.type}</span>
        <span className="muted" style={{ fontSize: 11 }}>conf {Math.round(node.confidence * 100)}%</span>
      </div>
      <textarea className="k-review-claim" rows={2} value={claim} onChange={(e) => setClaim(e.target.value)} />
      {sources.length > 0 && (
        <div className="k-review-sources">
          <span className="muted" style={{ fontSize: 11 }}>Generalized from:</span>
          {sources.map((s, i) => <span key={i} className="k-source">{s.node.title}</span>)}
        </div>
      )}
      <div className="k-review-actions">
        <button className="btn primary tiny" disabled={!!busy} onClick={() => onApprove(node._id, claim !== node.claim ? claim : undefined)}>✓ Approve</button>
        <button className="btn quiet tiny" disabled={!!busy} onClick={() => onReject(node._id)}>Reject</button>
      </div>
    </div>
  );
}

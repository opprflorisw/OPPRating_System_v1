import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SIM_START, SIM_TODAY, STAGE_BY_ID } from "../convex/pipeline";
import { replay, fmtEur, type DealState } from "../convex/derive";
import type { Deal } from "./types";
import { Board } from "./components/Board";
import { RecordCard } from "./components/RecordCard";
import { GateModal } from "./components/GateModal";
import { UpdateModal } from "./components/UpdateModal";
import { DispositionModal } from "./components/DispositionModal";
import { Clients } from "./components/Clients";
import { Standup } from "./components/Standup";
import { Library } from "./components/Library";
import { ChatDock } from "./components/ChatDock";

export interface DealRow {
  deal: Deal;
  state: DealState;
}

type Page = "pipeline" | "clients" | "standup" | "library";

const PAGE_TITLES: Record<Page, string> = {
  pipeline: "Pipeline",
  clients: "Clients",
  standup: "Monday Stand-up",
  library: "Library",
};

export default function App() {
  const deals = useQuery(api.deals.list, {}) as Deal[] | undefined;
  const resetScenario = useMutation(api.deals.resetScenario);

  const [page, setPage] = useState<Page>("pipeline");
  const [clientSlug, setClientSlug] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string>(SIM_TODAY);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<DealRow | null>(null);
  const [updateFor, setUpdateFor] = useState<{ row: DealRow; templateId?: string } | null>(null);
  const [dispositionFor, setDispositionFor] = useState<DealRow | null>(null);
  const [resetting, setResetting] = useState(false);

  const live = asOf === SIM_TODAY;
  const rows: DealRow[] = useMemo(
    () => (deals ?? []).map((deal) => ({ deal, state: replay(deal.events, deal.acv, asOf) })),
    [deals, asOf]
  );
  const selected = rows.find((r) => r.deal._id === selectedId) ?? null;

  const totals = useMemo(() => {
    const open = rows.filter((r) => {
      const s = STAGE_BY_ID[r.state.stageId];
      return !s.terminal && !s.parking;
    });
    return {
      pipeline: open.reduce((a, r) => a + r.deal.acv, 0),
      weighted: open.reduce((a, r) => a + r.state.weighted, 0),
      won: rows.filter((r) => r.state.stageId === "closed_won").reduce((a, r) => a + r.deal.acv, 0),
      openCount: open.length,
    };
  }, [rows]);

  const totalDays = Math.round((new Date(SIM_TODAY).getTime() - new Date(SIM_START).getTime()) / 86400000);
  const dayOffset = Math.round((new Date(asOf).getTime() - new Date(SIM_START).getTime()) / 86400000);
  const setDay = (n: number) =>
    setAsOf(new Date(new Date(SIM_START).getTime() + n * 86400000).toISOString().slice(0, 10));

  const seeded = deals !== undefined && deals.length > 0;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="side-brand">
          <div className="side-logo">O</div>
          <div className="side-name">OPPRating<small>Commercial Engine</small></div>
        </div>
        <nav className="side-nav">
          <NavItem icon={<IconBoard />} label="Pipeline" active={page === "pipeline"} onClick={() => setPage("pipeline")} />
          <NavItem icon={<IconPeople />} label="Clients" active={page === "clients"} onClick={() => { setPage("clients"); }} />
          <NavItem icon={<IconPulse />} label="Monday Stand-up" active={page === "standup"} onClick={() => setPage("standup")} />
          <NavItem icon={<IconBook />} label="Library" active={page === "library"} onClick={() => setPage("library")} />
        </nav>
        <div className="side-foot">
          <button
            className="btn quiet tiny"
            disabled={resetting}
            onClick={async () => {
              if (!confirm("Reset the simulated scenario? All your changes are wiped and the seed data restored.")) return;
              setResetting(true);
              try { await resetScenario({}); } finally { setResetting(false); }
            }}
          >
            {resetting ? "Resetting…" : seeded ? "↺ Reset scenario" : "Load scenario"}
          </button>
          <span className="sim-badge">SIMULATED DATA</span>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="page-title">{PAGE_TITLES[page]}</span>
          <div className="kpi-chips">
            <span className="chip">Pipeline <b>{fmtEur(totals.pipeline)}</b></span>
            <span className="chip">Weighted <b>{fmtEur(totals.weighted)}</b></span>
            <span className="chip">Won <b>{fmtEur(totals.won)}</b></span>
            <span className="chip">Open <b>{totals.openCount}</b></span>
          </div>
          <div className="replay">
            <span className="replay-label">Replay</span>
            <input type="range" min={0} max={totalDays} value={dayOffset} onChange={(e) => setDay(Number(e.target.value))} />
            <span className={"replay-date " + (live ? "live" : "past")}>{live ? "● live · " + asOf : asOf}</span>
            {!live && <button className="btn quiet tiny" onClick={() => setAsOf(SIM_TODAY)}>today</button>}
          </div>
        </header>

        <div className="content">
          {deals === undefined ? (
            <div className="empty">Connecting to Convex…</div>
          ) : !seeded ? (
            <div className="empty">
              <p>No scenario loaded yet.</p>
              <button className="btn primary" onClick={() => resetScenario({})}>Load the simulated scenario (13 NL targets)</button>
            </div>
          ) : page === "pipeline" ? (
            <Board rows={rows} live={live} onSelect={setSelectedId} onRequestMove={(row) => live && setPendingMove(row)} />
          ) : page === "clients" ? (
            <Clients
              rows={rows}
              asOf={asOf}
              clientSlug={clientSlug}
              onOpenClient={setClientSlug}
              onOpenDeal={setSelectedId}
              onNewSnapshot={(row) => live && setUpdateFor({ row, templateId: "meddic_snapshot" })}
              live={live}
            />
          ) : page === "standup" ? (
            <Standup rows={rows} asOf={asOf} />
          ) : (
            <Library />
          )}
        </div>
      </div>

      {selected && (
        <RecordCard
          row={selected}
          live={live}
          asOf={asOf}
          onClose={() => setSelectedId(null)}
          onFileUpdate={(templateId) => setUpdateFor({ row: selected, templateId })}
          onRequestMove={() => live && setPendingMove(selected)}
          onDisposition={() => live && setDispositionFor(selected)}
          onOpenClient={() => { setPage("clients"); setClientSlug(selected.deal.slug); setSelectedId(null); }}
        />
      )}
      {pendingMove && live && <GateModal row={pendingMove} asOf={asOf} onClose={() => setPendingMove(null)} />}
      {updateFor && live && (
        <UpdateModal row={updateFor.row} asOf={asOf} preselect={updateFor.templateId} onClose={() => setUpdateFor(null)} />
      )}
      {dispositionFor && live && <DispositionModal row={dispositionFor} asOf={asOf} onClose={() => setDispositionFor(null)} />}

      <ChatDock asOf={asOf} />
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={"nav-item" + (active ? " active" : "")} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

const sw = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconBoard() {
  return (
    <svg viewBox="0 0 16 16" {...sw}>
      <rect x="1.5" y="2" width="3.6" height="12" rx="1" />
      <rect x="6.2" y="2" width="3.6" height="8" rx="1" />
      <rect x="10.9" y="2" width="3.6" height="5" rx="1" />
    </svg>
  );
}
function IconPeople() {
  return (
    <svg viewBox="0 0 16 16" {...sw}>
      <circle cx="5.5" cy="5" r="2.4" />
      <path d="M1.5 13.5c0-2.2 1.8-4 4-4s4 1.8 4 4" />
      <circle cx="11.5" cy="5.5" r="1.9" />
      <path d="M10.5 9.7c2 .2 4 1.8 4 3.8" />
    </svg>
  );
}
function IconPulse() {
  return (
    <svg viewBox="0 0 16 16" {...sw}>
      <path d="M1.5 8.5h3l1.5-4 3 7 1.5-3h4" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg viewBox="0 0 16 16" {...sw}>
      <path d="M2 2.5h4.5c.8 0 1.5.7 1.5 1.5v9.5c0-.8-.7-1.5-1.5-1.5H2z" />
      <path d="M14 2.5H9.5C8.7 2.5 8 3.2 8 4v9.5c0-.8.7-1.5 1.5-1.5H14z" />
    </svg>
  );
}

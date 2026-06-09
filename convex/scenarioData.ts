// ============================================================================
// Seed scenario — HYPOTHETICAL deal histories for the 13 priority targets
// (waste collectors & WtE operators, Netherlands). Accounts, sites, throughput
// and contacts come from the real priority-targets research; every deal event,
// number and quote below is SIMULATED to exercise the pipeline machine.
// Sim window: 2026-01-05 .. 2026-06-09.
// ============================================================================

import type { DealEvent } from "./pipeline";

export interface SeedDeal {
  slug: string;
  account: string;
  site: string;
  region: string;
  throughput: string;
  capability: string;
  hook: string;
  acv: number;
  pocFee?: number;
  owner: string;
  events: DealEvent[];
}

const S = "Sales" as const;
const M = "Marketing" as const;
const I = "I&S" as const;

export const SEED_DEALS: SeedDeal[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // 1 · ATTERO WIJSTER — POC week ~11, value validated, procurement dragging
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "attero-wijster",
    account: "Attero",
    site: "Wijster (Drenthe)",
    region: "NL-North",
    throughput: "~2,700 t/day",
    capability: "Separation + WtE",
    hook: "Plastics in RDF burn twice: CO2 levy paid + recyclate value lost. Lijn 13 input characterisation.",
    acv: 75000,
    pocFee: 25000,
    owner: "Floris",
    events: [
      { at: "2026-01-08", author: "Marketing (sim)", discipline: M, type: "template", templateId: "campaign_touch", payload: { channel: "Referral", play: "Warm intro via TVC network; hook: plastics-in-RDF = CO2 levy + lost recyclate value on Lijn 13.", engagement: "Meeting agreed", next_play: "Hand to Sales with context pack" } },
      { at: "2026-01-12", author: "Floris", discipline: S, type: "template", templateId: "prep", payload: { produce: true, complexity: true, attendees: true, news: true, agenda: true, success_def: "Fred (ops mgr) agrees the plastics-in-RDF problem is worth a structured look at Lijn 13.", meeting_date: "2026-01-15" }, gatesSatisfied: ["prep_filed", "meeting_booked"] },
      { at: "2026-01-15", author: "Floris", discipline: S, type: "stage", from: "lead", to: "discovery" },
      { at: "2026-01-20", author: "Floris", discipline: S, type: "template", templateId: "discovery_debrief", payload: { attendees: "Fred (Ops Manager), shift lead Lijn 13", core_problem: "Too much plastic ends up in the RDF stream: they pay the CO2 levy on it AND lose the recyclate value.", urgency: "CO2-heffing curve climbs to EUR 136.79/t by 2030; waste-tax reform under review. Every month of status quo is real money.", icp_fit: true, champion: "Fred — Ops Manager Wijster, trusted by plant leadership", next_step: "Use-case email + site visit with shift leads", next_meeting: "2026-02-03" }, gatesSatisfied: ["core_problem", "urgency", "icp_fit", "champion_candidate", "structured_next_step", "next_meeting"] },
      { at: "2026-02-03", author: "Floris", discipline: S, type: "template", templateId: "discovery_debrief", payload: { attendees: "Fred + 2 shift leads + process engineer", core_problem: "Confirmed; also shift-handover info loss on input quality.", urgency: "Confirmed at plant level", icp_fit: true, champion: "Fred confirmed driving internally", insights: "Problem: 4 · ICP: 3 · Decision: 3 · Champion: 4 · Objections: 3 · Interest: 5", next_step: "Scope POC on Lijn 13", next_meeting: "2026-02-12" }, gatesSatisfied: ["insights_3"] },
      { at: "2026-02-06", author: "Floris", discipline: S, type: "stage", from: "discovery", to: "solution_validation" },
      { at: "2026-02-18", author: "Floris", discipline: S, type: "template", templateId: "solval_update", payload: { use_cases: "1) Input characterisation Lijn 13 (operator voice + photo logs per truckload) 2) Shift-handover log 3) Downtime cause capture", success_criteria: true, poc_scope: true, poc_decision: "Charles (GM Moerdijk-cluster) owns EUR 25K pilot budget", decision_driver: "EUR", arr_pricing: true, notes: "10-week POC scoped on Lijn 13, success = characterise 80% of input batches + 3 actionable correlations" }, gatesSatisfied: ["use_cases", "success_criteria", "poc_scope", "poc_decision", "decision_driver", "arr_pricing"] },
      { at: "2026-03-05", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: { metrics: "Avoided CO2 levy on plastics share + recovered recyclate value; sim estimate EUR 300-450K/yr at Wijster scale", eb: "Charles — GM, ENGAGED since site visit 2026-02-26", criteria: "Proven on own line, operator adoption >70%, IT-light deployment", process: "POC: Charles signs. ARR: local IC with group sign-off", pain: "Plastics-in-RDF; handover info loss", champion: "Fred — STRONG (organises access, sells internally)", acv: 75000, close_target: "2026-08-15", next_step: "POC offer out", blocker: "" }, gatesSatisfied: ["meddic_cp1", "champion_confirmed", "arr_decision"], note: "CP1 review held with sales lead. Full MEDDIC attached." },
      { at: "2026-03-12", author: "Floris", discipline: S, type: "stage", from: "solution_validation", to: "poc" },
      { at: "2026-03-20", author: "Forward Eng (sim)", discipline: I, type: "template", templateId: "poc_update", payload: { week: 1, substatus: "Offer Signed", adoption: 0, milestones: "Offer + NDA signed; QR plan for Lijn 13 made", value_signal: 0, blocker: "", next: "Asset setup + operator onboarding" }, gatesSatisfied: ["offer_signed"] },
      { at: "2026-04-02", author: "Forward Eng (sim)", discipline: I, type: "template", templateId: "poc_update", payload: { week: 3, substatus: "POC Active", adoption: 35, milestones: "PO received; on-site workshop done; day shift logging", value_signal: 0, blocker: "Night shift not onboarded", next: "Night shift onboarding" }, gatesSatisfied: ["po_received", "workshop_date", "personas"] },
      { at: "2026-04-24", author: "Forward Eng (sim)", discipline: I, type: "template", templateId: "poc_update", payload: { week: 6, substatus: "POC Active", adoption: 64, milestones: "412 logs; first correlation: wet-feed batches from supplier X -> sorter trips", value_signal: 38000, blocker: "", next: "Validate correlation with process data" }, note: "Champion forwarded results to GM unprompted." },
      { at: "2026-05-15", author: "Forward Eng (sim)", discipline: I, type: "template", templateId: "poc_update", payload: { week: 9, substatus: "POC Validated", adoption: 71, milestones: "Success criteria met: 84% batches characterised, 3 validated correlations", value_signal: 62000, blocker: "", next: "ROI session with Charles" }, gatesSatisfied: ["value_validated", "it_security"] },
      { at: "2026-06-02", author: "Floris", discipline: S, type: "template", templateId: "poc_update", payload: { week: 11, substatus: "POC Validated", adoption: 73, milestones: "ROI vs EUR metric presented: EUR 340K/yr conservative", value_signal: 340000, blocker: "Vendor onboarding with procurement is slow", next: "Procurement kickoff + MEDDIC refresh (CP2)" }, gatesSatisfied: ["roi_metric"] },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 2 · ATTERO MOERDIJK (AZN) — Closed Won (hypothetical), incl. one override
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "attero-moerdijk",
    account: "Attero",
    site: "Moerdijk — AZN (N-Brabant)",
    region: "NL-South",
    throughput: "~1,400 t/day",
    capability: "WtE only",
    hook: "Sister-site expansion of the Wijster relationship: combustion-stability know-how capture.",
    acv: 60000,
    pocFee: 25000,
    owner: "Floris",
    events: [
      { at: "2026-01-22", author: "Floris", discipline: S, type: "template", templateId: "prep", payload: { produce: true, complexity: true, attendees: true, news: true, agenda: true, success_def: "GM agrees to mirror the Wijster track on AZN.", meeting_date: "2026-01-28" }, gatesSatisfied: ["prep_filed", "meeting_booked"] },
      { at: "2026-01-28", author: "Floris", discipline: S, type: "stage", from: "lead", to: "discovery" },
      { at: "2026-02-10", author: "Floris", discipline: S, type: "template", templateId: "discovery_debrief", payload: { attendees: "GM + maintenance manager", core_problem: "Senior furnace operators retiring; combustion-stability know-how undocumented.", urgency: "Two retirements scheduled Q3 2026.", icp_fit: true, champion: "Maintenance Manager AZN", insights: "Problem: 3 · ICP: 3 · Decision: 3 · Champion: 3 · Objections: 3 · Interest: 4", next_step: "Compressed validation (leveraging Wijster trust)", next_meeting: "2026-02-24" }, gatesSatisfied: ["core_problem", "urgency", "icp_fit", "champion_candidate", "structured_next_step", "next_meeting", "insights_3"] },
      { at: "2026-02-24", author: "Floris", discipline: S, type: "stage", from: "discovery", to: "solution_validation" },
      { at: "2026-03-18", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: { metrics: "Avoided unplanned outage hours on the grate; sim EUR 200K/yr", eb: "GM AZN — engaged (knows Wijster results)", criteria: "Same platform as Wijster, no new IT review", process: "Local DM with group sign-off", pain: "Retiring know-how", champion: "Maintenance Manager — strong", acv: 60000, close_target: "2026-05-30", next_step: "Short POC", blocker: "" }, gatesSatisfied: ["meddic_cp1", "use_cases", "success_criteria", "poc_scope", "champion_confirmed", "poc_decision", "arr_decision", "decision_driver", "arr_pricing"], note: "CP1 — compressed; gates carried over from Wijster playbook." },
      { at: "2026-03-25", author: "Floris", discipline: S, type: "stage", from: "solution_validation", to: "poc" },
      { at: "2026-04-20", author: "Forward Eng (sim)", discipline: I, type: "template", templateId: "poc_update", payload: { week: 4, substatus: "POC Validated", adoption: 68, milestones: "Voice rounds live on grate + boiler; baseline drift flagged twice", value_signal: 45000, blocker: "", next: "ROI + contract" }, gatesSatisfied: ["offer_signed", "po_received", "workshop_date", "personas", "value_validated", "it_security", "roi_metric"] },
      { at: "2026-05-04", author: "Floris", discipline: S, type: "stage", from: "poc", to: "negotiation", override: true, note: "OVERRIDE: moved to Negotiation with procurement_engaged and meddic_cp2 unmet — GM pushed pace. Flagged for review." },
      { at: "2026-05-12", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: { metrics: "EUR 200K/yr avoided outage (validated in POC)", eb: "GM AZN — engaged, sponsoring", criteria: "Validated", process: "DM + group sign-off, mapped", pain: "Retiring know-how", champion: "Maintenance Manager — strong", acv: 60000, close_target: "2026-05-30", next_step: "Legal docs", blocker: "" }, gatesSatisfied: ["meddic_cp2", "procurement_engaged"], note: "CP2 refresh filed late, clears the override flag's missing gates." },
      { at: "2026-05-20", author: "Floris", discipline: S, type: "template", templateId: "nego_update", payload: { controlling: true, legal: "DPA + NDA + SLA + Master signed", pricing: 60000, signature: true, close_plan: "2026-05-28", notes: "IC criteria addressed in deck v2" }, gatesSatisfied: ["controlling", "ic_criteria", "final_pricing", "legal_docs", "signature_path", "close_plan"] },
      { at: "2026-05-28", author: "Floris", discipline: S, type: "stage", from: "negotiation", to: "closed_won", note: "Signed yearly ARR contract EUR 60K. Line items: POC 25K / Implementation 12K / ARR 60K. Post-sale handoff: Integration + Success boards opened; reference asset task filed to Marketing." },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 3 · RENEWI — Stagnated ("doing it themselves"), real status from the list
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "renewi",
    account: "Renewi",
    site: "Multiple NL sites",
    region: "NL",
    throughput: "Recycling-led",
    capability: "Recycling-led",
    hook: "ADR track-trace + pyrolysis line knowledge capture (ATM Moerdijk history).",
    acv: 80000,
    owner: "Floris",
    events: [
      { at: "2026-01-09", author: "Floris", discipline: S, type: "template", templateId: "prep", payload: { produce: true, complexity: true, attendees: true, news: true, agenda: true, success_def: "Re-open the relationship beyond the ATM pilot.", meeting_date: "2026-01-14" }, gatesSatisfied: ["prep_filed", "meeting_booked"] },
      { at: "2026-01-14", author: "Floris", discipline: S, type: "stage", from: "lead", to: "discovery" },
      { at: "2026-01-28", author: "Floris", discipline: S, type: "template", templateId: "discovery_debrief", payload: { attendees: "Site ops + group digital lead", core_problem: "ADR goods storage compliance + operator rounds on paper.", urgency: "Medium — internal digital programme running", icp_fit: true, champion: "Site ops lead (lukewarm)", next_step: "Follow-up with group digital", next_meeting: "2026-02-18" }, gatesSatisfied: ["core_problem", "icp_fit", "champion_candidate", "next_meeting"] },
      { at: "2026-02-20", author: "Floris", discipline: S, type: "template", templateId: "disposition", payload: { kind: "Stagnated", reason: "Doing it themselves", detail: "Group digital programme will build logging in-house first. Door open if it stalls.", reactivation: "2026-09-01" } },
      { at: "2026-02-20", author: "Floris", discipline: S, type: "stage", from: "discovery", to: "stagnated", note: "Paused-from: Discovery. Reactivation check 2026-09-01. Monthly watch-list." },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 4 · EEW DELFZIJL — Solution Validation, the classic EB gap
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "eew-delfzijl",
    account: "EEW Energy from Waste",
    site: "Delfzijl — Farmsum (Groningen)",
    region: "NL-North",
    throughput: "~800 t/day",
    capability: "WtE only",
    hook: "576 kt/yr plant; new sludge line ramping. Grate/boiler operator intuition -> structured data layer.",
    acv: 70000,
    pocFee: 25000,
    owner: "Floris",
    events: [
      { at: "2026-02-12", author: "Marketing (sim)", discipline: M, type: "template", templateId: "campaign_touch", payload: { channel: "LinkedIn outbound", play: "Warm-entry route via Marleen Houwing (Country Manager NL) -> Wilfred de Jager (Technical MD).", engagement: "Engaged", next_play: "Dutch-context intro call" } },
      { at: "2026-02-26", author: "Floris", discipline: S, type: "template", templateId: "prep", payload: { produce: true, complexity: true, attendees: true, news: true, agenda: true, success_def: "Wilfred sees the link between feed variability and the knowledge walking out at shift change.", meeting_date: "2026-03-04" }, gatesSatisfied: ["prep_filed", "meeting_booked"] },
      { at: "2026-03-04", author: "Floris", discipline: S, type: "stage", from: "lead", to: "discovery" },
      { at: "2026-03-17", author: "Floris", discipline: S, type: "template", templateId: "discovery_debrief", payload: { attendees: "Wilfred de Jager (Technical MD) + control-room supervisor", core_problem: "Feed variability drives downtime and recovery yield; 'I can hear the grate about to clinker' knowledge is unlogged.", urgency: "Sludge line ramp + CO2 levy to EUR 136.79/t by 2030", icp_fit: true, champion: "Wilfred de Jager — Technical MD, strong technical authority", insights: "Problem: 4 · ICP: 3 · Decision: 2 · Champion: 4 · Objections: 3 · Interest: 4", next_step: "Use-case workshop with control room", next_meeting: "2026-04-08" }, gatesSatisfied: ["core_problem", "urgency", "icp_fit", "champion_candidate", "structured_next_step", "next_meeting", "insights_3"] },
      { at: "2026-04-15", author: "Floris", discipline: S, type: "stage", from: "discovery", to: "solution_validation" },
      { at: "2026-05-06", author: "Floris", discipline: S, type: "template", templateId: "solval_update", payload: { use_cases: "1) Grate-clinker early warning (voice) 2) Boiler-fouling photo rounds 3) Sludge-line ramp log", success_criteria: false, poc_scope: true, poc_decision: "Wilfred can approve EUR 25K locally", decision_driver: "Hours", arr_pricing: true, notes: "Scope agreed technically. Commercial side not in the room yet." }, gatesSatisfied: ["use_cases", "poc_scope", "poc_decision", "decision_driver", "arr_pricing"] },
      { at: "2026-05-20", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: { metrics: "Avoided unplanned outage hours; sim EUR 250K/yr at 576 kt", eb: "Sebastian Siewers (Commercial MD, carries site P&L) — IDENTIFIED, NOT ENGAGED", criteria: "Stable output during sludge ramp; works in control-room noise", process: "Group IC (Helmstedt) for ARR — to map", pain: "Unlogged operator intuition on grate/boiler", champion: "Wilfred de Jager — strong", acv: 70000, close_target: "2026-09-30", next_step: "Get Sebastian in the room via Wilfred", blocker: "EB not engaged — success criteria cannot be co-signed" }, gatesSatisfied: ["meddic_cp1", "champion_confirmed"], note: "CP1 held. E is the open letter: deal cannot exit Sol-Val until EB co-signs." },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 5 · HVC ALKMAAR — POC stage, offer sent but not signed
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "hvc-alkmaar",
    account: "HVC",
    site: "Alkmaar (N-Holland)",
    region: "NL-West",
    throughput: "~1,700 t/day",
    capability: "Separation + WtE",
    hook: "Public-sector mandate (53 municipalities): circularity + knowledge continuity across two WtE sites.",
    acv: 65000,
    pocFee: 25000,
    owner: "Floris",
    events: [
      { at: "2026-02-04", author: "Floris", discipline: S, type: "template", templateId: "prep", payload: { produce: true, complexity: true, attendees: true, news: true, agenda: true, success_def: "Hein Bloemen (Dir. Energie uit Afval) sponsors a one-line look.", meeting_date: "2026-02-10" }, gatesSatisfied: ["prep_filed", "meeting_booked"] },
      { at: "2026-02-10", author: "Floris", discipline: S, type: "stage", from: "lead", to: "discovery" },
      { at: "2026-02-25", author: "Floris", discipline: S, type: "template", templateId: "discovery_debrief", payload: { attendees: "Hein Bloemen + Alkmaar plant manager", core_problem: "Crew turnover at two WtE sites; furnace/feed decisions unlogged; municipal owners ask for circularity evidence.", urgency: "CO2-heffing + owner reporting pressure", icp_fit: true, champion: "Hein Bloemen — runs the WtE division", insights: "Problem: 4 · ICP: 4 · Decision: 3 · Champion: 4 · Objections: 2 · Interest: 4", next_step: "Scope POC at Alkmaar line", next_meeting: "2026-03-10" }, gatesSatisfied: ["core_problem", "urgency", "icp_fit", "champion_candidate", "structured_next_step", "next_meeting", "insights_3"] },
      { at: "2026-03-12", author: "Floris", discipline: S, type: "stage", from: "discovery", to: "solution_validation" },
      { at: "2026-04-09", author: "Floris", discipline: S, type: "template", templateId: "solval_update", payload: { use_cases: "1) Furnace stability voice log 2) Feed-quality photo rounds 3) Owner-reporting evidence trail", success_criteria: true, poc_scope: true, poc_decision: "Hein approves EUR 25K from division budget", decision_driver: "%", arr_pricing: true, notes: "Public-sector procurement flagged early — aanbesteding threshold check done." }, gatesSatisfied: ["use_cases", "success_criteria", "poc_scope", "poc_decision", "decision_driver", "arr_pricing"] },
      { at: "2026-04-28", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: { metrics: "% unplanned downtime reduction target 20%; owner-report automation", eb: "Hein Bloemen doubles as EB for division-level spend — engaged", criteria: "Public-sector data handling (EU-only), works on shared tablets", process: "Division DM <= EUR 100K; above goes to directie", pain: "Crew turnover + evidence gap", champion: "Alkmaar plant manager — growing", acv: 65000, close_target: "2026-10-15", next_step: "POC offer out", blocker: "" }, gatesSatisfied: ["meddic_cp1", "champion_confirmed", "arr_decision"], note: "CP1 held." },
      { at: "2026-05-06", author: "Floris", discipline: S, type: "stage", from: "solution_validation", to: "poc" },
      { at: "2026-05-13", author: "Forward Eng (sim)", discipline: I, type: "template", templateId: "poc_update", payload: { week: 1, substatus: "Offer Sent", adoption: 0, milestones: "POC offer + NDA sent 2026-05-12", value_signal: 0, blocker: "NDA in legal review (public-sector terms)", next: "Chase legal; pencil workshop date" } },
      { at: "2026-06-03", author: "Forward Eng (sim)", discipline: I, type: "template", templateId: "poc_update", payload: { week: 4, substatus: "Offer Sent", adoption: 0, milestones: "Still in legal. Workshop window slipping.", value_signal: 0, blocker: "Legal redlines on liability clause", next: "Floris call with Hein to unblock" } },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 6 · HVC DORDRECHT — Discovery, early
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "hvc-dordrecht",
    account: "HVC",
    site: "Dordrecht (Z-Holland)",
    region: "NL-West",
    throughput: "~1,200 t/day",
    capability: "WtE only",
    hook: "Second HVC site — rides on the Alkmaar relationship once the POC lands.",
    acv: 55000,
    owner: "Floris",
    events: [
      { at: "2026-05-12", author: "Floris", discipline: S, type: "template", templateId: "prep", payload: { produce: true, complexity: true, attendees: true, news: true, agenda: true, success_def: "Dordrecht plant manager mirrors the Alkmaar problem statement.", meeting_date: "2026-05-19" }, gatesSatisfied: ["prep_filed", "meeting_booked"] },
      { at: "2026-05-19", author: "Floris", discipline: S, type: "stage", from: "lead", to: "discovery" },
      { at: "2026-05-27", author: "Floris", discipline: S, type: "template", templateId: "discovery_debrief", payload: { attendees: "Dordrecht plant manager", core_problem: "Same crew-turnover pattern as Alkmaar; older control room, more paper.", icp_fit: true, champion: "Plant manager Dordrecht (candidate)", next_step: "Joint session with Alkmaar champion", next_meeting: "2026-06-17" }, gatesSatisfied: ["core_problem", "icp_fit", "champion_candidate", "next_meeting"] },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 7 · AEB AMSTERDAM — Solution Validation, early (largest plant, big ACV)
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "aeb-amsterdam",
    account: "AEB Amsterdam",
    site: "Amsterdam — Westpoort",
    region: "NL-West",
    throughput: "~3,800 t/day",
    capability: "Separation + WtE",
    hook: "Biggest single site on the list; separation + WtE means both input characterisation and furnace use cases.",
    acv: 90000,
    pocFee: 25000,
    owner: "Floris",
    events: [
      { at: "2026-03-09", author: "Floris", discipline: S, type: "template", templateId: "prep", payload: { produce: true, complexity: true, attendees: true, news: true, agenda: true, success_def: "Ops director agrees separation-line input quality is the wedge.", meeting_date: "2026-03-16" }, gatesSatisfied: ["prep_filed", "meeting_booked"] },
      { at: "2026-03-16", author: "Floris", discipline: S, type: "stage", from: "lead", to: "discovery" },
      { at: "2026-04-01", author: "Floris", discipline: S, type: "template", templateId: "discovery_debrief", payload: { attendees: "Operations director + separation line manager", core_problem: "Sorting yield varies per input stream; operator observations about contamination never reach planning.", urgency: "Recyclate price pressure + CO2 levy", icp_fit: true, champion: "Separation line manager", insights: "Problem: 4 · ICP: 4 · Decision: 3 · Champion: 3 · Objections: 3 · Interest: 4", next_step: "Use-case workshop", next_meeting: "2026-04-22" }, gatesSatisfied: ["core_problem", "urgency", "icp_fit", "champion_candidate", "structured_next_step", "next_meeting", "insights_3"] },
      { at: "2026-05-20", author: "Floris", discipline: S, type: "stage", from: "discovery", to: "solution_validation" },
      { at: "2026-06-04", author: "Floris", discipline: S, type: "template", templateId: "solval_update", payload: { use_cases: "1) Contamination logging on infeed 2) Sorter-trip cause capture 3) Yield handover log", success_criteria: false, poc_scope: false, poc_decision: "", decision_driver: "EUR", arr_pricing: false, notes: "Use cases landed. Success criteria session planned; EB mapping not started." }, gatesSatisfied: ["use_cases", "decision_driver"] },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 8 · PREZERO ROOSENDAAL — Lead, gates green, ready to convert
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "prezero-roosendaal",
    account: "PreZero",
    site: "Roosendaal (N-Brabant)",
    region: "NL-South",
    throughput: "~820 t/day",
    capability: "WtE (group recycles)",
    hook: "Group-level recycling strategy; local WtE plant carries the knowledge-continuity pain.",
    acv: 60000,
    owner: "Floris",
    events: [
      { at: "2026-05-21", author: "Marketing (sim)", discipline: M, type: "template", templateId: "campaign_touch", payload: { channel: "Event", play: "Met plant manager at Recycling Symposium NL; CO2-levy margin talk resonated.", engagement: "Meeting agreed", next_play: "Sales takes over with prep" } },
      { at: "2026-06-03", author: "Floris", discipline: S, type: "template", templateId: "prep", payload: { produce: true, complexity: true, attendees: true, news: true, agenda: true, success_def: "Plant manager owns the problem statement and brings ops + maintenance to meeting 2.", meeting_date: "2026-06-16" }, gatesSatisfied: ["prep_filed", "meeting_booked"] },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 9 · AVR ROTTERDAM (BOTLEK) — Negotiation, legal pending
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "avr-rotterdam",
    account: "AVR",
    site: "Rotterdam — Botlek / Rozenburg",
    region: "NL-West",
    throughput: "~3,800 t/day",
    capability: "Separation + WtE",
    hook: "Flagship plant; post-separation capacity makes the recyclate-value case concrete.",
    acv: 85000,
    pocFee: 25000,
    owner: "Floris",
    events: [
      { at: "2026-01-13", author: "Floris", discipline: S, type: "template", templateId: "prep", payload: { produce: true, complexity: true, attendees: true, news: true, agenda: true, success_def: "Plant director agrees to discovery at Botlek.", meeting_date: "2026-01-19" }, gatesSatisfied: ["prep_filed", "meeting_booked"] },
      { at: "2026-01-19", author: "Floris", discipline: S, type: "stage", from: "lead", to: "discovery" },
      { at: "2026-02-02", author: "Floris", discipline: S, type: "template", templateId: "discovery_debrief", payload: { attendees: "Plant director + ops manager + CI lead", core_problem: "Separation yield swings with input mix; root causes argued from memory in morning meetings.", urgency: "Waste-tax reform on imported waste hits Botlek volumes", icp_fit: true, champion: "CI lead — drives the morning meeting", insights: "Problem: 5 · ICP: 4 · Decision: 4 · Champion: 4 · Objections: 3 · Interest: 5", next_step: "Sol-val workshop", next_meeting: "2026-02-16" }, gatesSatisfied: ["core_problem", "urgency", "icp_fit", "champion_candidate", "structured_next_step", "next_meeting", "insights_3"] },
      { at: "2026-02-18", author: "Floris", discipline: S, type: "stage", from: "discovery", to: "solution_validation" },
      { at: "2026-03-06", author: "Floris", discipline: S, type: "template", templateId: "solval_update", payload: { use_cases: "1) Input-mix observation log 2) Yield-deviation cause capture 3) Morning-meeting evidence feed", success_criteria: true, poc_scope: true, poc_decision: "Ops director owns pilot budget", decision_driver: "EUR", arr_pricing: true, notes: "" }, gatesSatisfied: ["use_cases", "success_criteria", "poc_scope", "poc_decision", "decision_driver", "arr_pricing"] },
      { at: "2026-03-13", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: { metrics: "Yield + levy case sim EUR 500K/yr at Botlek scale", eb: "Ops director — engaged", criteria: "Morning meeting adoption; integration-light", process: "Local IC, mapped", pain: "Yield swings argued from memory", champion: "CI lead — strong", acv: 85000, close_target: "2026-07-01", next_step: "POC offer", blocker: "" }, gatesSatisfied: ["meddic_cp1", "champion_confirmed", "arr_decision"], note: "CP1 held." },
      { at: "2026-03-19", author: "Floris", discipline: S, type: "stage", from: "solution_validation", to: "poc" },
      { at: "2026-04-30", author: "Forward Eng (sim)", discipline: I, type: "template", templateId: "poc_update", payload: { week: 6, substatus: "POC Validated", adoption: 76, milestones: "Success criteria met early; CI lead presents weekly from Oppr data", value_signal: 120000, blocker: "", next: "CP2 + procurement" }, gatesSatisfied: ["offer_signed", "po_received", "workshop_date", "personas", "value_validated", "it_security", "roi_metric", "procurement_engaged"] },
      { at: "2026-05-08", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: { metrics: "EUR 500K/yr validated trajectory", eb: "Ops director — sponsoring", criteria: "Met", process: "IC scheduled 2026-06-20", pain: "Confirmed", champion: "CI lead — very strong", acv: 85000, close_target: "2026-07-01", next_step: "Contract + IC deck", blocker: "" }, gatesSatisfied: ["meddic_cp2"], note: "CP2 refresh after POC." },
      { at: "2026-05-12", author: "Floris", discipline: S, type: "stage", from: "poc", to: "negotiation" },
      { at: "2026-05-26", author: "Floris", discipline: S, type: "template", templateId: "nego_update", payload: { controlling: true, legal: "NDA + SLA done; DPA in security review; Master draft v2", pricing: 85000, signature: false, close_plan: "", notes: "DPA security questionnaire is the long pole" }, gatesSatisfied: ["controlling", "final_pricing"] },
      { at: "2026-06-05", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: { metrics: "EUR 500K/yr", eb: "Ops director — sponsoring, IC 2026-06-20", criteria: "Met", process: "IC 2026-06-20 then signature", pain: "Confirmed", champion: "CI lead", acv: 85000, close_target: "2026-07-01", next_step: "Close plan after IC", blocker: "DPA review" }, note: "CP3-fresh MEDDIC (within 14 days) — deal may sit in Commit." },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 10 · AVR DUIVEN — Discovery, stuck & rotting (no urgency confirmed)
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "avr-duiven",
    account: "AVR",
    site: "Duiven (Gelderland)",
    region: "NL-East",
    throughput: "~2,500 t/day",
    capability: "WtE only",
    hook: "Second AVR site; waiting on Botlek momentum.",
    acv: 70000,
    owner: "Floris",
    events: [
      { at: "2026-02-17", author: "Floris", discipline: S, type: "template", templateId: "prep", payload: { produce: true, complexity: true, attendees: true, news: true, agenda: true, success_def: "Plant manager sees a local case beyond 'Botlek is doing it'.", meeting_date: "2026-02-25" }, gatesSatisfied: ["prep_filed", "meeting_booked"] },
      { at: "2026-02-25", author: "Floris", discipline: S, type: "stage", from: "lead", to: "discovery" },
      { at: "2026-03-20", author: "Floris", discipline: S, type: "template", templateId: "discovery_debrief", payload: { attendees: "Plant manager Duiven", core_problem: "Boiler availability dips, causes debated; some interest in rounds digitisation.", icp_fit: true, champion: "None clear — plant manager polite but passive", next_step: "Promised intro to maintenance lead (not scheduled)", insights: "Problem: 2 · ICP: 3 · Decision: 1 · Champion: 1 · Objections: 2 · Interest: 2" }, gatesSatisfied: ["core_problem", "icp_fit"] },
      { at: "2026-03-20", author: "Floris", discipline: S, type: "note", note: "No urgency confirmed, no champion. Parking effort until Botlek closes — but deal left open in Discovery. (Deliberate: this is what rotting looks like.)" },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 11 · ARN WEURT — Lead, prep not done (gates red)
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "arn-weurt",
    account: "ARN",
    site: "Weurt — Nijmegen (Gelderland)",
    region: "NL-East",
    throughput: "~770 t/day",
    capability: "Separation + digestion",
    hook: "Separation + digestion = double use-case surface (input characterisation + digester stability).",
    acv: 45000,
    owner: "Floris",
    events: [
      { at: "2026-05-28", author: "Marketing (sim)", discipline: M, type: "template", templateId: "campaign_touch", payload: { channel: "LinkedIn outbound", play: "Digester-stability hook to ops manager; reply received.", engagement: "Engaged", next_play: "Book intro call" } },
      { at: "2026-06-05", author: "Floris", discipline: S, type: "note", note: "Reply positive, call proposed for week of 15 June. Prep NOT yet filed — deal cannot convert to Discovery." },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 12 · TWENCE HENGELO — Discovery, mid
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "twence-hengelo",
    account: "Twence",
    site: "Hengelo (Overijssel)",
    region: "NL-East",
    throughput: "~1,650 t/day",
    capability: "Separation (in progress)",
    hook: "New separation line commissioning: capture commissioning knowledge from day one instead of retrofitting.",
    acv: 65000,
    owner: "Floris",
    events: [
      { at: "2026-04-14", author: "Floris", discipline: S, type: "template", templateId: "prep", payload: { produce: true, complexity: true, attendees: true, news: true, agenda: true, success_def: "Project lead of the new separation line sees Oppr as commissioning tool.", meeting_date: "2026-04-21" }, gatesSatisfied: ["prep_filed", "meeting_booked"] },
      { at: "2026-04-21", author: "Floris", discipline: S, type: "stage", from: "lead", to: "discovery" },
      { at: "2026-05-07", author: "Floris", discipline: S, type: "template", templateId: "discovery_debrief", payload: { attendees: "Separation-line project lead + ops manager", core_problem: "New line commissioning: every learning lives in the project team's heads; handover to operations is the risk.", urgency: "Line goes live Q4 2026 — window to embed capture from day one", icp_fit: true, champion: "Project lead — candidate, energetic", next_step: "Second session with operations team", insights: "Problem: 3 · ICP: 3 · Decision: 2 · Champion: 3 · Objections: 2 · Interest: 4" }, gatesSatisfied: ["core_problem", "urgency", "icp_fit", "champion_candidate", "insights_3"] },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 13 · OMRIN / REC HARLINGEN — Lead, fresh
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "omrin-harlingen",
    account: "Omrin / REC",
    site: "Harlingen (Friesland)",
    region: "NL-North",
    throughput: "~630 t/day",
    capability: "Separation + WtE",
    hook: "Municipal circularity frontrunner; smaller plant, fast decision lines.",
    acv: 50000,
    owner: "Floris",
    events: [
      { at: "2026-06-04", author: "Marketing (sim)", discipline: M, type: "template", templateId: "campaign_touch", payload: { channel: "Content", play: "Downloaded CO2-levy margin one-pager; follow-up sequence started.", engagement: "Cold", next_play: "Outbound to plant manager with Frisian-municipal angle" } },
    ],
  },
];

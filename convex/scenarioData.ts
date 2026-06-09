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
      { at: "2026-01-20", author: "Floris", discipline: S, type: "template", templateId: "discovery_debrief",
        evidenceText: "30 min w/ Charles (ops mgr EfW) + shift lead lijn 13. Big pain: way too much plastic ends up in the RDF -> they eat the CO2 levy on it AND lose the recyclate value. Charles says levy goes to ~137/t by 2030, waste tax reform on top. He requested the demo himself, wants shift leads in the next session. Next: use-case email + site visit, 3 feb.",
        payload: { attendees: "Charles de Wolff (Ops Mgr EfW), shift lead Lijn 13", core_problem: "Too much plastic ends up in the RDF stream: they pay the CO2 levy on it AND lose the recyclate value.", urgency: "CO2-heffing curve climbs to EUR 136.79/t by 2030; waste-tax reform under review. Every month of status quo is real money.", icp_fit: true, champion: "Charles de Wolff — Ops Mgr EfW Wijster, strong political capital", next_step: "Use-case email + site visit with shift leads", next_meeting: "2026-02-03" },
        provenance: { core_problem: { kind: "ai", quote: "way too much plastic ends up in the RDF -> they eat the CO2 levy on it AND lose the recyclate value" }, urgency: { kind: "ai", quote: "levy goes to ~137/t by 2030, waste tax reform on top" }, champion: { kind: "ai", quote: "He requested the demo himself" }, next_meeting: { kind: "ai", quote: "use-case email + site visit, 3 feb" }, attendees: { kind: "ai-edited" } },
        gatesSatisfied: ["core_problem", "urgency", "icp_fit", "champion_candidate", "structured_next_step", "next_meeting"] },
      { at: "2026-02-03", author: "Floris", discipline: S, type: "template", templateId: "discovery_debrief", payload: { attendees: "Charles + 2 shift leads + process engineer", core_problem: "Confirmed; also shift-handover info loss on input quality. Steering is blind to a 24-48h RCA lag.", urgency: "Confirmed at plant level", icp_fit: true, champion: "Charles confirmed driving internally — requested the demo himself", insights: "Problem: 4 · ICP: 3 · Decision: 3 · Champion: 4 · Objections: 3 · Interest: 5", next_step: "Scope POC on Lijn 13", next_meeting: "2026-02-12" }, gatesSatisfied: ["insights_3"] },
      { at: "2026-01-28", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: {
        metrics: "Plastics-in-RDF cost floated: CO2 levy + lost recyclate value. No numbers yet.", metrics_score: "2", metrics_gap: "Quantify with their tonnage.",
        pain: "Plastic in the RDF stream; steering blind to a 24-48h RCA lag.", pain_score: "3", pain_gap: "Make it personal to a named owner.",
        champion: "Charles de Wolff — candidate, requested the demo himself.", champion_score: "3", champion_gap: "Not yet tested.",
        verdict: "Light capture at Discovery — M, I and C floated, the rest is unknown.", acv: 75000, next_step: "Second session with shift leads" }, note: "MEDDIC begins — light capture at Discovery. 8/15 on three letters." },
      { at: "2026-02-06", author: "Floris", discipline: S, type: "stage", from: "discovery", to: "solution_validation" },
      { at: "2026-02-18", author: "Floris", discipline: S, type: "template", templateId: "solval_update", payload: { use_cases: "1) Input characterisation Lijn 13 (operator voice + photo logs per truckload) 2) Shift-handover log 3) Downtime cause capture", success_criteria: true, poc_scope: true, poc_decision: "Carla Schambach prepares the overeenkomst and holds PoC signing authority (briefed via Charles)", decision_driver: "EUR", arr_pricing: true, notes: "10-week POC scoped on Lijn 13, success = characterise 80% of input batches + 3 actionable correlations" }, gatesSatisfied: ["use_cases", "success_criteria", "poc_scope", "poc_decision", "decision_driver", "arr_pricing"] },
      { at: "2026-03-05", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: {
        metrics: "Operational baseline strong: doorzet, beschikbaarheid, zuiverheid, plastics-in-RDF, 24-48h RCA lag — with today-vs-target gaps.", metrics_score: "3", metrics_gap: "No translation to EUR yet; targets not committed by Attero.",
        eb: "Carla Schambach — prepares the overeenkomst, PoC signing authority. Briefed via Charles, present 30 min.", eb_score: "2", eb_gap: "Not spoken to directly. License-level EB unknown — EUR 75K likely needs group sign-off.",
        criteria: "Hypothesised: proven financial value on Lijn 13, ease of use, transferability.", criteria_score: "2", criteria_gap: "Inferred from Charles's draft, not ranked or confirmed by the buyer. No EUR threshold for a successful PoC.",
        process: "PoC path clear: scouting voorstel -> overeenkomst -> 10-week PoC. NDA signed.", process_score: "3", process_gap: "Approval threshold, procurement, IT/InfoSec all TBD. License paper process unmapped.",
        pain: "No automated monitoring; steering blind to 24-48h lag; variability blocks cause-and-effect.", pain_score: "3", pain_gap: "Pain not in money and not personal yet — what does red-on-the-dashboard mean to Charles?",
        champion: "Charles de Wolff (Ops Mgr EfW): requested demo, hosted visit, briefs the EB, authoring the scouting voorstel.", champion_score: "4", champion_gap: "Single-threaded. Power over operations, not the contract.",
        verdict: "Winning the PoC, under-building the deal.", acv: 75000, close_target: "2026-08-15", next_step: "POC offer out + quantify the EUR case in the voorstel", blocker: "" }, gatesSatisfied: ["meddic_cp1", "champion_confirmed", "arr_decision"], note: "CP1 review held with sales lead. Full MEDDIC attached. 17/30." },
      { at: "2026-03-12", author: "Floris", discipline: S, type: "stage", from: "solution_validation", to: "poc" },
      { at: "2026-03-20", author: "Forward Eng (sim)", discipline: I, type: "template", templateId: "poc_update", payload: { week: 1, substatus: "Offer Signed", adoption: 0, milestones: "Offer + NDA signed; QR plan for Lijn 13 made", value_signal: 0, blocker: "", next: "Asset setup + operator onboarding" }, gatesSatisfied: ["offer_signed"] },
      { at: "2026-04-02", author: "Forward Eng (sim)", discipline: I, type: "template", templateId: "poc_update", payload: { week: 3, substatus: "POC Active", adoption: 35, milestones: "PO received; on-site workshop done; day shift logging", value_signal: 0, blocker: "Night shift not onboarded", next: "Night shift onboarding" }, gatesSatisfied: ["po_received", "workshop_date", "personas"] },
      { at: "2026-04-16", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: {
        metrics: "POC data starting to land: first correlations visible, admin-hours model added as second lever.", metrics_score: "3", metrics_gap: "EUR case still ours, not validated by Attero.",
        eb: "Carla — still briefed via Charles only.", eb_score: "2", eb_gap: "No direct conversation booked. License-level EB still unknown.",
        criteria: "Success criteria from the voorstel now being measured weekly in the POC.", criteria_score: "3", criteria_gap: "Still no agreed EUR threshold for 'successful PoC'.",
        process: "Overeenkomst signed; PoC running. IT path informally OK.", process_score: "3", process_gap: "License process still unmapped; procurement not engaged.",
        pain: "Wet-feed correlation made the lag pain concrete for the shift leads.", pain_score: "3", pain_gap: "Still not anchored to a named owner in money.",
        champion: "Charles presenting POC results internally on his own initiative.", champion_score: "4", champion_gap: "Still single-threaded; recruit the reliability engineer + a shift lead.",
        verdict: "POC healthy; deal architecture unchanged — same four gaps as CP1.", acv: 75000, close_target: "2026-08-15", next_step: "Direct meeting with Carla; EUR validation session", blocker: "" }, note: "Working snapshot, mid-POC." },
      { at: "2026-04-24", author: "Forward Eng (sim)", discipline: I, type: "template", templateId: "poc_update", payload: { week: 6, substatus: "POC Active", adoption: 64, milestones: "412 logs; first correlation: wet-feed batches from supplier X -> sorter trips", value_signal: 38000, blocker: "", next: "Validate correlation with process data" }, note: "Charles forwarded results to Carla unprompted." },
      { at: "2026-05-15", author: "Forward Eng (sim)", discipline: I, type: "template", templateId: "poc_update", payload: { week: 9, substatus: "POC Validated", adoption: 71, milestones: "Success criteria met: 84% batches characterised, 3 validated correlations", value_signal: 62000, blocker: "", next: "ROI session with Charles" }, gatesSatisfied: ["value_validated", "it_security"] },
      { at: "2026-06-02", author: "Floris", discipline: S, type: "template", templateId: "poc_update", payload: { week: 11, substatus: "POC Validated", adoption: 73, milestones: "ROI vs EUR metric presented: EUR 340K/yr conservative", value_signal: 340000, blocker: "Vendor onboarding with procurement is slow", next: "Procurement kickoff + MEDDIC refresh (CP2)" }, gatesSatisfied: ["roi_metric"] },
      { at: "2026-06-05", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: {
        metrics: "EUR 340K/yr conservative, presented and directionally accepted; admin-hours lever validated in POC.", metrics_score: "3", metrics_gap: "Attero has not committed the assumptions in writing.",
        eb: "Carla engaged on the PoC paper; one direct call held 2026-05-27.", eb_score: "2", eb_gap: "License-level signer still unconfirmed — group sign-off path unknown.",
        criteria: "POC success criteria met and documented against the voorstel.", criteria_score: "3", criteria_gap: "License decision criteria not ranked by the buyer.",
        process: "POC done. License path: IC local expected, summer window is the risk.", process_score: "3", process_gap: "Procurement vendor onboarding slow; no mutual close plan.",
        pain: "Lag pain proven with the wet-feed correlation; team uses it daily.", pain_score: "4", pain_gap: "Anchor it to Charles's own KPI accountability for the license case.",
        champion: "Charles very strong — presents Oppr data in the morning meeting.", champion_score: "4", champion_gap: "Reliability engineer recruited as second thread; floor user still TBD.",
        verdict: "Classic PoC trap risk: everyone happy, signature undefined. Fix EB + close plan before summer.", acv: 75000, close_target: "2026-08-15", next_step: "Procurement kickoff; map license IC; mutual close plan", blocker: "Vendor onboarding with procurement is slow" }, gatesSatisfied: ["meddic_cp2"], note: "CP2 refresh after POC validation. 19/30." },
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
      { at: "2026-03-18", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: {
        metrics: "Avoided unplanned outage hours on the grate; sim EUR 200K/yr, model accepted in principle.", metrics_score: "3", metrics_gap: "Validate the outage baseline with maintenance data.",
        eb: "GM AZN — engaged directly, knows the Wijster results.", eb_score: "4", eb_gap: "Group sign-off threshold to confirm.",
        criteria: "Same platform as Wijster, no new IT review, value on grate availability.", criteria_score: "3", criteria_gap: "Not yet ranked.",
        process: "Local DM with group sign-off; path mapped with dates.", process_score: "4", process_gap: "",
        pain: "Two senior furnace operators retire Q3 2026; know-how undocumented. GM owns the risk personally.", pain_score: "4", pain_gap: "",
        champion: "Maintenance Manager — strong, organising access.", champion_score: "4", champion_gap: "Single-threaded.",
        verdict: "Fast-follower deal riding Wijster trust; real risk is pace, not substance.", acv: 60000, close_target: "2026-05-30", next_step: "Short POC", blocker: "" }, gatesSatisfied: ["meddic_cp1", "use_cases", "success_criteria", "poc_scope", "champion_confirmed", "poc_decision", "arr_decision", "decision_driver", "arr_pricing"], note: "CP1 — compressed; gates carried over from Wijster playbook. 22/30." },
      { at: "2026-03-25", author: "Floris", discipline: S, type: "stage", from: "solution_validation", to: "poc" },
      { at: "2026-04-20", author: "Forward Eng (sim)", discipline: I, type: "template", templateId: "poc_update", payload: { week: 4, substatus: "POC Validated", adoption: 68, milestones: "Voice rounds live on grate + boiler; baseline drift flagged twice", value_signal: 45000, blocker: "", next: "ROI + contract" }, gatesSatisfied: ["offer_signed", "po_received", "workshop_date", "personas", "value_validated", "it_security", "roi_metric"] },
      { at: "2026-05-04", author: "Floris", discipline: S, type: "stage", from: "poc", to: "negotiation", override: true, note: "OVERRIDE: moved to Negotiation with procurement_engaged and meddic_cp2 unmet — GM pushed pace. Flagged for review." },
      { at: "2026-05-12", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: {
        metrics: "EUR 200K/yr avoided outage — validated against maintenance data in the POC.", metrics_score: "4", metrics_gap: "",
        eb: "GM AZN — sponsoring, drives the pace himself.", eb_score: "5", eb_gap: "",
        criteria: "Validated and ranked: availability first, transferability second.", criteria_score: "4", criteria_gap: "",
        process: "DM + group sign-off mapped, signature path confirmed.", process_score: "5", process_gap: "",
        pain: "Q3 retirements; GM personally accountable for grate availability.", pain_score: "4", pain_gap: "",
        champion: "Maintenance Manager strong; shift leads onboarded.", champion_score: "4", champion_gap: "",
        verdict: "Committable. Close on the GM's timeline.", acv: 60000, close_target: "2026-05-30", next_step: "Legal docs", blocker: "" }, gatesSatisfied: ["meddic_cp2", "procurement_engaged"], note: "CP2 refresh filed late, clears the override flag's missing gates. 26/30." },
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
      { at: "2026-03-17", author: "Floris", discipline: S, type: "template", templateId: "discovery_debrief",
        evidenceText: "(voice memo, transcribed) Just out of Delfzijl. Wilfred is the real deal, technical MD, knows every bolt. Control room supervisor literally said 'I can hear the grate about to clinker' — that sentence IS our pitch. Sludge line ramping makes stable output critical right now. Wilfred wants a use-case workshop with the control room crew, 8 April. Commercial side was not in the room, need to figure out who carries the P&L.",
        payload: { attendees: "Wilfred de Jager (Technical MD) + control-room supervisor", core_problem: "Feed variability drives downtime and recovery yield; 'I can hear the grate about to clinker' knowledge is unlogged.", urgency: "Sludge line ramp + CO2 levy to EUR 136.79/t by 2030", icp_fit: true, champion: "Wilfred de Jager — Technical MD, strong technical authority", insights: "Problem: 4 · ICP: 3 · Decision: 2 · Champion: 4 · Objections: 3 · Interest: 4", next_step: "Use-case workshop with control room", next_meeting: "2026-04-08" },
        provenance: { core_problem: { kind: "ai", quote: "'I can hear the grate about to clinker' — that sentence IS our pitch" }, urgency: { kind: "ai", quote: "Sludge line ramping makes stable output critical right now" }, champion: { kind: "ai", quote: "Wilfred is the real deal, technical MD, knows every bolt" }, next_meeting: { kind: "ai", quote: "use-case workshop with the control room crew, 8 April" } },
        gatesSatisfied: ["core_problem", "urgency", "icp_fit", "champion_candidate", "structured_next_step", "next_meeting", "insights_3"] },
      { at: "2026-04-15", author: "Floris", discipline: S, type: "stage", from: "discovery", to: "solution_validation" },
      { at: "2026-05-06", author: "Floris", discipline: S, type: "template", templateId: "solval_update", payload: { use_cases: "1) Grate-clinker early warning (voice) 2) Boiler-fouling photo rounds 3) Sludge-line ramp log", success_criteria: false, poc_scope: true, poc_decision: "Wilfred can approve EUR 25K locally", decision_driver: "Hours", arr_pricing: true, notes: "Scope agreed technically. Commercial side not in the room yet." }, gatesSatisfied: ["use_cases", "poc_scope", "poc_decision", "decision_driver", "arr_pricing"] },
      { at: "2026-04-22", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: {
        metrics: "Outage-hours hypothesis only; no baseline data yet.", metrics_score: "2", metrics_gap: "Get maintenance data for a real baseline.",
        eb: "Unclear — commercial side never in the room.", eb_score: "1", eb_gap: "Identify who carries the site P&L.",
        criteria: "Technical wishes from the control room, nothing commercial.", criteria_score: "2", criteria_gap: "No buyer-side criteria at all.",
        process: "Unknown beyond 'Wilfred can approve the pilot'.", process_score: "1", process_gap: "Group IC (Helmstedt) structure to map.",
        pain: "Grate-clinker intuition unlogged; sludge ramp raises the stakes.", pain_score: "3", pain_gap: "Not in money.",
        champion: "Wilfred de Jager — strong technical authority, organising the workshop.", champion_score: "4", champion_gap: "Technical champion; no commercial counterpart.",
        verdict: "Technically loved, commercially unowned.", acv: 70000, close_target: "2026-09-30", next_step: "Use-case workshop, then map the commercial side", blocker: "" }, note: "Working snapshot, early sol-val. 13/30." },
      { at: "2026-05-20", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: {
        metrics: "Avoided unplanned outage hours; sim EUR 250K/yr at 576 kt — our model, not theirs.", metrics_score: "3", metrics_gap: "Customer has not validated the assumptions.",
        eb: "Sebastian Siewers (Commercial MD, carries site P&L) — IDENTIFIED, NOT ENGAGED.", eb_score: "2", eb_gap: "No direct contact. Success criteria cannot be co-signed without him.",
        criteria: "Stable output during sludge ramp; works in control-room noise.", criteria_score: "2", criteria_gap: "Technical only; commercial criteria unknown.",
        process: "Group IC (Helmstedt) for ARR — identified but unmapped.", process_score: "2", process_gap: "No names, thresholds or dates.",
        pain: "Unlogged operator intuition on grate/boiler; ramp makes it urgent.", pain_score: "4", pain_gap: "Anchor to Sebastian's P&L.",
        champion: "Wilfred de Jager — strong, gives access, advocates.", champion_score: "4", champion_gap: "Single-threaded on the technical side.",
        verdict: "The E is the deal. Everything else waits on one meeting.", acv: 70000, close_target: "2026-09-30", next_step: "Get Sebastian in the room via Wilfred", blocker: "EB not engaged — success criteria cannot be co-signed" }, gatesSatisfied: ["meddic_cp1", "champion_confirmed"], note: "CP1 held. E is the open letter: deal cannot exit Sol-Val until EB co-signs. 17/30." },
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
      { at: "2026-04-28", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: {
        metrics: "20% unplanned-downtime reduction target + owner-report automation hours.", metrics_score: "3", metrics_gap: "Translate to EUR for the directie.",
        eb: "Hein Bloemen doubles as EB for division-level spend — engaged, sponsoring.", eb_score: "4", eb_gap: "Above EUR 100K goes to directie — keep scope under the threshold.",
        criteria: "Public-sector data handling (EU-only), works on shared tablets, evidence for municipal owners.", criteria_score: "3", criteria_gap: "Rank them with Hein.",
        process: "Division DM <= EUR 100K; above goes to directie. Aanbesteding threshold checked.", process_score: "3", process_gap: "Legal review path underestimated.",
        pain: "Crew turnover at two WtE sites + owner evidence gap.", pain_score: "3", pain_gap: "Make it personal to the plant manager.",
        champion: "Alkmaar plant manager — growing into the role.", champion_score: "3", champion_gap: "Young champion; Hein is sponsor, not day-to-day driver.",
        verdict: "Healthy public-sector deal; paper will be the long pole.", acv: 65000, close_target: "2026-10-15", next_step: "POC offer out", blocker: "" }, gatesSatisfied: ["meddic_cp1", "champion_confirmed", "arr_decision"], note: "CP1 held. 19/30." },
      { at: "2026-05-06", author: "Floris", discipline: S, type: "stage", from: "solution_validation", to: "poc" },
      { at: "2026-05-13", author: "Forward Eng (sim)", discipline: I, type: "template", templateId: "poc_update", payload: { week: 1, substatus: "Offer Sent", adoption: 0, milestones: "POC offer + NDA sent 2026-05-12", value_signal: 0, blocker: "NDA in legal review (public-sector terms)", next: "Chase legal; pencil workshop date" } },
      { at: "2026-06-03", author: "Forward Eng (sim)", discipline: I, type: "template", templateId: "poc_update",
        evidenceText: "Slack: hvc legal came back AGAIN on the liability clause, third round. offer still unsigned, week 4. workshop window for june is basically gone unless this clears this week. hein is supportive but hands-off — floris should call him directly.",
        payload: { week: 4, substatus: "Offer Sent", adoption: 0, milestones: "Still in legal. Workshop window slipping.", value_signal: 0, blocker: "Legal redlines on liability clause", next: "Floris call with Hein to unblock" },
        provenance: { blocker: { kind: "ai", quote: "legal came back AGAIN on the liability clause, third round" }, next: { kind: "ai", quote: "floris should call him directly" } } },
      { at: "2026-06-05", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: {
        metrics: "Unchanged — 20% downtime target + reporting hours.", metrics_score: "3", metrics_gap: "EUR translation still owed.",
        eb: "Hein engaged but hands-off on legal.", eb_score: "4", eb_gap: "Ask Hein to lean on legal directly.",
        criteria: "Unchanged.", criteria_score: "3", criteria_gap: "Ranking session still open.",
        process: "Stuck in legal redlines (liability clause) for 4 weeks.", process_score: "2", process_gap: "Process score DOWN: legal path was underestimated.",
        pain: "Unchanged.", pain_score: "3", pain_gap: "",
        champion: "Plant manager quiet during the legal wait.", champion_score: "3", champion_gap: "Keep him warm — share a Wijster-style result.",
        verdict: "Deal healthy, paper stuck. The blocker is ours to break, not theirs.", acv: 65000, close_target: "2026-10-15", next_step: "Floris call with Hein to unblock legal", blocker: "Legal redlines on liability clause" }, note: "Refresh during the legal wait. 18/30 — process slipped." },
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
      { at: "2026-02-08", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: {
        metrics: "Yield swings + levy exposure named in the morning meeting; magnitude unknown.", metrics_score: "2", metrics_gap: "Model with their volumes.",
        pain: "Yield argued from memory daily; import-tax pressure on Botlek volumes.", pain_score: "4", pain_gap: "",
        champion: "CI lead — candidate, owns the morning meeting.", champion_score: "3", champion_gap: "Confirm appetite to drive internally.",
        verdict: "Light capture at Discovery — strong pain signal, everything else open.", acv: 85000, next_step: "Sol-val workshop" }, note: "MEDDIC begins — light capture at Discovery." },
      { at: "2026-02-18", author: "Floris", discipline: S, type: "stage", from: "discovery", to: "solution_validation" },
      { at: "2026-03-06", author: "Floris", discipline: S, type: "template", templateId: "solval_update", payload: { use_cases: "1) Input-mix observation log 2) Yield-deviation cause capture 3) Morning-meeting evidence feed", success_criteria: true, poc_scope: true, poc_decision: "Ops director owns pilot budget", decision_driver: "EUR", arr_pricing: true, notes: "" }, gatesSatisfied: ["use_cases", "success_criteria", "poc_scope", "poc_decision", "decision_driver", "arr_pricing"] },
      { at: "2026-03-13", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: {
        metrics: "Yield + levy case sim EUR 500K/yr at Botlek scale.", metrics_score: "3", metrics_gap: "Their controller has not seen the model.",
        eb: "Ops director — engaged from discovery, in the room.", eb_score: "3", eb_gap: "Confirm he signs at EUR 85K or it goes to IC.",
        criteria: "Morning-meeting adoption; integration-light; proof on own line.", criteria_score: "3", criteria_gap: "Not ranked.",
        process: "Local IC, mapped at high level.", process_score: "3", process_gap: "IC calendar + paper requirements to pin down.",
        pain: "Yield swings argued from memory every morning; waste-tax reform hits Botlek import volumes.", pain_score: "4", pain_gap: "",
        champion: "CI lead — strong, owns the morning meeting.", champion_score: "4", champion_gap: "Add an operations thread.",
        verdict: "Best-architected deal in the pipeline.", acv: 85000, close_target: "2026-07-01", next_step: "POC offer", blocker: "" }, gatesSatisfied: ["meddic_cp1", "champion_confirmed", "arr_decision"], note: "CP1 held. 20/30." },
      { at: "2026-03-19", author: "Floris", discipline: S, type: "stage", from: "solution_validation", to: "poc" },
      { at: "2026-04-30", author: "Forward Eng (sim)", discipline: I, type: "template", templateId: "poc_update", payload: { week: 6, substatus: "POC Validated", adoption: 76, milestones: "Success criteria met early; CI lead presents weekly from Oppr data", value_signal: 120000, blocker: "", next: "CP2 + procurement" }, gatesSatisfied: ["offer_signed", "po_received", "workshop_date", "personas", "value_validated", "it_security", "roi_metric", "procurement_engaged"] },
      { at: "2026-05-08", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: {
        metrics: "EUR 500K/yr trajectory validated in POC; controller reviewed the model.", metrics_score: "4", metrics_gap: "",
        eb: "Ops director — sponsoring, presents to IC himself.", eb_score: "4", eb_gap: "",
        criteria: "Met and ranked; success criteria signed off early.", criteria_score: "4", criteria_gap: "",
        process: "IC scheduled 2026-06-20; paper requirements listed.", process_score: "4", process_gap: "DPA security review timing.",
        pain: "Confirmed daily in the morning meeting — CI lead presents from Oppr data.", pain_score: "4", pain_gap: "",
        champion: "CI lead very strong; ops manager second thread active.", champion_score: "5", champion_gap: "",
        verdict: "Commit-grade if the IC date holds.", acv: 85000, close_target: "2026-07-01", next_step: "Contract + IC deck", blocker: "" }, gatesSatisfied: ["meddic_cp2"], note: "CP2 refresh after POC. 25/30." },
      { at: "2026-05-12", author: "Floris", discipline: S, type: "stage", from: "poc", to: "negotiation" },
      { at: "2026-05-26", author: "Floris", discipline: S, type: "template", templateId: "nego_update", payload: { controlling: true, legal: "NDA + SLA done; DPA in security review; Master draft v2", pricing: 85000, signature: false, close_plan: "", notes: "DPA security questionnaire is the long pole" }, gatesSatisfied: ["controlling", "final_pricing"] },
      { at: "2026-06-05", author: "Floris", discipline: S, type: "template", templateId: "meddic_snapshot", payload: {
        metrics: "EUR 500K/yr — in the IC deck, controller-approved.", metrics_score: "4", metrics_gap: "",
        eb: "Ops director sponsoring; IC 2026-06-20.", eb_score: "4", eb_gap: "",
        criteria: "Met.", criteria_score: "4", criteria_gap: "",
        process: "IC 2026-06-20 then signature; DPA security questionnaire is the long pole.", process_score: "4", process_gap: "DPA review could slip the IC date.",
        pain: "Confirmed.", pain_score: "4", pain_gap: "",
        champion: "CI lead + ops manager, both active.", champion_score: "5", champion_gap: "",
        verdict: "Commit. Protect the IC date — chase the DPA daily.", acv: 85000, close_target: "2026-07-01", next_step: "Close plan after IC", blocker: "DPA review" }, note: "CP3-fresh MEDDIC (within 14 days) — deal sits in Commit. 25/30." },
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

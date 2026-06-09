// ============================================================================
// OPPRating System — Pipeline definition
// Source: Oppr · Commercial Ops · Pipeline Operating Manual (Lars Grønkjær,
// June 2026, v1.0). Stages, exit gates and checkpoints encoded as data.
// This file is the single source of truth, shared by the Convex backend and
// the React frontend. When this moves to HubSpot: stage -> pipeline stage,
// gate -> conditional stage property, template -> form / Claude skill.
// ============================================================================

export type GateType = "check" | "text" | "number" | "currency" | "date" | "contact";

export interface Gate {
  id: string;
  label: string;
  type: GateType;
  cp?: "CP1" | "CP2" | "CP3";
  hint?: string;
  // What success looks like + the pitfall — fed to the AI coach and shown to users.
  coach?: string;
}

export interface Stage {
  id: string;
  name: string;
  short: string;
  order: number;
  probability: number; // win probability, drives weighted forecast
  forecastCategory: "Pipeline" | "Upside" | "Commit" | "Closed" | "Omitted";
  purpose: string;
  checkpoint?: { id: "CP1" | "CP2" | "CP3"; label: string };
  // Gates that must be satisfied to EXIT this stage (= enter the next one).
  exitGates: Gate[];
  terminal?: boolean;
  parking?: boolean;
}

export const STAGES: Stage[] = [
  {
    id: "lead",
    name: "Lead",
    short: "LEAD",
    order: 0,
    probability: 5,
    forecastCategory: "Pipeline",
    purpose:
      "New lead from inbound, outbound, events or referrals. A deal does not enter Discovery until prep is done.",
    exitGates: [
      { id: "prep_filed", label: "Pre-meeting prep filed (6-point self-check)", type: "check", coach: "Success = you could brief a colleague on this plant in 2 minutes: what they produce, where complexity sits, who's in the room and why each attendee cares. A bad first meeting produces bad pipeline — the manager spot-checks this before the deal converts." },
      { id: "meeting_booked", label: "First meeting booked with date", type: "date", coach: "A real calendar date, not 'they'll come back to us'. No date = no deal." },
    ],
  },
  {
    id: "discovery",
    name: "Discovery",
    short: "DISC",
    order: 1,
    probability: 10,
    forecastCategory: "Pipeline",
    purpose:
      "Confirm structural ICP fit, urgency, pain and a Champion candidate. Multi-touch. MEDDIC light capture.",
    exitGates: [
      { id: "core_problem", label: "Aligned on core problem", type: "text", coach: "Success = the problem in THEIR words, tied to an operation (a line, a furnace, a stream), not generic industry pain. Test: would the customer nod if you read it back?" },
      { id: "urgency", label: "Urgency confirmed", type: "text", coach: "Why NOW: a levy curve, a retirement date, a commissioning window, a reorganisation. 'They seem interested' is not urgency — urgency has a date or a euro attached." },
      { id: "icp_fit", label: "ICP structural fit confirmed (250+ FTE, OE-aware, 3-10 sites)", type: "check", coach: "The pattern we sell into: variable input + operator judgment + expensive asset. If inputs are consistent and sensors already cover everything, disqualify now and save months." },
      { id: "champion_candidate", label: "Champion candidate identified (HQ influence potential)", type: "contact", coach: "Name + role + why them. A great champion gives access, advocates internally and has HQ influence potential. Beware the tech-enthusiast who loves pilots but has never taken one to production." },
      { id: "structured_next_step", label: "Agreement to structured next step, multiple stakeholders", type: "check", coach: "Multi-stakeholder is the point: one enthusiastic contact is a conversation, not a deal. Get the ops manager AND a second voice into the next session." },
      { id: "next_meeting", label: "Exact date for next meeting set", type: "date", coach: "Always leave a meeting with the next one booked. Momentum dies in 'we'll find a slot'." },
      { id: "insights_3", label: ">=3 insights per category (Problem / ICP / Decision / Champion / Objections / Interest)", type: "number", coach: "The insights log proves discovery depth. If Decision or Objections sit at 0-1, you've been pitching, not discovering — go back with questions." },
    ],
  },
  {
    id: "solution_validation",
    name: "Solution Validation",
    short: "SOL-VAL",
    order: 2,
    probability: 25,
    forecastCategory: "Pipeline",
    purpose:
      "Pre-POC alignment. Get to the Economic Buyer and qualify the ARR decision before any POC paper is written.",
    checkpoint: { id: "CP1", label: "Pre-POC MEDDIC review — mandatory, no exceptions" },
    exitGates: [
      { id: "use_cases", label: "Main use cases agreed (~3) tied to operational pain", type: "text", cp: "CP1", coach: "Around 3, each tied to a pain THEY named, each demonstrable in 10 weeks. More than 4 means no focus; one means no resilience if it underwhelms." },
      { id: "success_criteria", label: "Success criteria co-signed by Champion AND EB", type: "check", cp: "CP1", coach: "The sharpest deal risk: define PoC success on what Oppr CONTROLS (decision latency, correlations surfaced, admin hours), never on KPIs we don't control (throughput, availability). Frame KPIs as trajectory + business case, not pass/fail — or one bad-feedstock month sinks a perfect PoC. And it must be co-signed by the EB, not just the champion." },
      { id: "poc_scope", label: "POC scope defined, 10-week target timeline", type: "check", cp: "CP1", coach: "One line, 10 weeks, milestones written down. The PoC is a means to an end — it de-risks the ARR deal, it is not the product." },
      { id: "champion_confirmed", label: "Champion confirmed (access, advocates, HQ influence)", type: "contact", cp: "CP1", coach: "Confirmed = has already DONE something: hosted a visit, briefed the EB, authored an internal document. Pressure-test: has this person ever taken a pilot to production? Multi-thread early — single-threaded deals die in summer." },
      { id: "poc_decision", label: "POC decision process mapped (EUR 25K pilot budget owner)", type: "text", cp: "CP1", coach: "Who signs the EUR 25K, by name, and what they need to sign. 'The champion will arrange it' is not a process." },
      { id: "arr_decision", label: "ARR decision process mapped (IC local/global or DM + sign-off)", type: "text", cp: "CP1", coach: "The REAL deal is the yearly contract — map its paper process now: IC local or global, thresholds, who signs above what. The classic failure: PoC path clear, license path unmapped, summer becomes a black hole." },
      { id: "decision_driver", label: "Decision driver confirmed: Hours, % or EUR saved", type: "text", cp: "CP1", coach: "Ask the EB which currency convinces them — hours, percent or euros — and build every ROI conversation in that currency." },
      { id: "arr_pricing", label: "ARR pricing range socialised, blockers identified", type: "check", cp: "CP1", coach: "Say the yearly number out loud BEFORE the PoC starts. If EUR 75K/yr is a problem, you want to know now, not in week 11." },
      { id: "meddic_cp1", label: "Full MEDDIC attached + Last Reviewed date (CP1)", type: "date", cp: "CP1", coach: "No POC paper goes out without a full MEDDIC reviewed by the sales lead, EB in the room. Score every letter honestly — a 2 on E with a plan beats a flattering 4." },
    ],
  },
  {
    id: "poc",
    name: "POC",
    short: "POC",
    order: 3,
    probability: 50,
    forecastCategory: "Upside",
    purpose:
      "Validate technical fit on customer data (Oppr Lite, 10-week build). Build procurement runway in parallel.",
    checkpoint: { id: "CP2", label: "Post-POC MEDDIC refresh before Procurement" },
    exitGates: [
      { id: "offer_signed", label: "POC offer signed + NDA", type: "check", cp: "CP2", coach: "The offer must reflect the pre-POC alignment: use cases, scope, ROI. If legal sits on it more than 2 weeks, escalate via the champion — paper delays kill momentum." },
      { id: "po_received", label: "PO received (PDF preferred)", type: "check", cp: "CP2", coach: "Email confirmation works, a PDF PO is better. No PO = the organisation hasn't actually committed." },
      { id: "workshop_date", label: "On-site workshop date set", type: "date", coach: "The on-site kickoff is where adoption starts. Get it on the calendar before the ink dries." },
      { id: "personas", label: "Personas captured: Plant/Ops, IT/Security, Procurement", type: "check", coach: "Name the Technical Coach and a Floor User too — the people who decide whether it STICKS are rarely the people who signed." },
      { id: "value_validated", label: "Oppr value validated against agreed success criteria", type: "check", cp: "CP2", coach: "Validated against the CO-SIGNED criteria, with the data to show it. Avoid the PoC trap: operations improve, everyone is happy, nobody agreed what a win was worth — no signature." },
      { id: "it_security", label: "IT / security path confirmed by email", type: "check", coach: "In writing, even informally. EU-only data residency and tenant isolation answer most questions — get the objections out before procurement." },
      { id: "roi_metric", label: "ROI calculated against EB's chosen metric (Hours / % / EUR)", type: "currency", cp: "CP2", coach: "In the EB's currency, with assumptions the customer validated. An ROI 'we' built alone motivates nobody to sign EUR 75K." },
      { id: "procurement_engaged", label: "Procurement engaged, vendor onboarding started", type: "check", coach: "Ask 'can we get procurement involved now?' as early as the customer allows. Vendor onboarding takes weeks — run it parallel to the POC, not after." },
      { id: "meddic_cp2", label: "MEDDIC refreshed against POC learnings (CP2)", type: "date", cp: "CP2", coach: "Refresh against what the POC taught you: competition surfaced? decision process still true? Scores should MOVE — identical scores after 10 weeks means nobody looked." },
    ],
  },
  {
    id: "negotiation",
    name: "Procurement & Negotiation",
    short: "NEGO",
    order: 4,
    probability: 75,
    forecastCategory: "Commit",
    purpose:
      "Negotiate the yearly contract. Commit forecast requires CP3: MEDDIC reviewed within 14 days.",
    checkpoint: { id: "CP3", label: "Pre-Commit: MEDDIC Last Reviewed <= 14 days" },
    exitGates: [
      { id: "controlling", label: "Controlling approved", type: "check", coach: "Finance has seen the number and nodded. If controlling hasn't been briefed, the IC meeting will be the first time they hear the price — bad place for surprises." },
      { id: "ic_criteria", label: "IC criteria addressed in the deck", type: "check", coach: "The deck answers the committee's actual criteria, in their order, in the EB's currency. The champion presents it — make it effortless for them." },
      { id: "final_pricing", label: "Final pricing agreed (at/above floor or finance sign-off)", type: "currency", coach: "At or above the floor, or get finance sign-off first. A discount nobody approved is a future fight." },
      { id: "legal_docs", label: "Legal docs closed: DPA, NDA, SLA, Master Contract", type: "check", coach: "Track all four by name. The DPA security questionnaire is usually the long pole — chase it daily, it can slip an IC date." },
      { id: "signature_path", label: "Signature path confirmed (who signs, when, order)", type: "check", coach: "Who signs, in what order, by when. Deals slip weeks because the second signer was on holiday and nobody knew." },
      { id: "close_plan", label: "Mutual close-plan date agreed by Champion + EB", type: "date", cp: "CP3", coach: "MUTUAL means the customer wrote the date with you. Commit forecast requires MEDDIC reviewed within 14 days — a Commit on a stale MEDDIC is a guess wearing a suit." },
    ],
  },
  {
    id: "closed_won",
    name: "Closed Won",
    short: "WON",
    order: 5,
    probability: 100,
    forecastCategory: "Closed",
    purpose:
      "Signed yearly ARR contract. POC and implementation fees are not wins. Triggers post-sale handoff.",
    exitGates: [],
    terminal: true,
  },
  {
    id: "stagnated",
    name: "Stagnated",
    short: "STAG",
    order: 6,
    probability: 0,
    forecastCategory: "Omitted",
    purpose:
      "Paused with an active blocker (frozen budget, leadership change, timing). On the watch-list, reviewed monthly.",
    exitGates: [],
    parking: true,
  },
  {
    id: "closed_lost",
    name: "Closed Lost",
    short: "LOST",
    order: 7,
    probability: 0,
    forecastCategory: "Omitted",
    purpose: "Off the books. Mandatory lost reason.",
    exitGates: [],
    terminal: true,
    parking: true,
  },
];

export const STAGE_BY_ID: Record<string, Stage> = Object.fromEntries(
  STAGES.map((s) => [s.id, s])
);

export const BOARD_STAGES = STAGES.filter((s) => !s.parking);

export function nextStageId(stageId: string): string | null {
  const s = STAGE_BY_ID[stageId];
  if (!s || s.terminal || s.parking) return null;
  const next = STAGES.find((x) => x.order === s.order + 1 && !x.parking);
  return next ? next.id : null;
}

// ============================================================================
// Templates — the standard records each discipline files.
// Filing a template appends an event to the deal record and can satisfy gates
// (gatesSatisfied). The person carries the conversation; the template carries
// the standard.
// ============================================================================

export type Discipline = "Sales" | "Marketing" | "RevOps" | "I&S";

export interface TemplateField {
  id: string;
  label: string;
  kind: "text" | "longtext" | "number" | "currency" | "date" | "select" | "check";
  options?: string[];
  satisfiesGate?: string; // gate id this field can satisfy when filled
  group?: string; // visual grouping in the form (e.g. per MEDDIC letter)
  hint?: string; // what good looks like — also fed to the AI extractor
}

// Who can file a record. Sim roster — today everything is Floris.
export const TEAM = [
  "Floris",
  "Sales Exec (sim)",
  "Forward Eng (sim)",
  "Marketing (sim)",
  "RevOps (sim)",
];

// The MEDDIC letters — single source for forms, record card and client page.
export const MEDDIC_LETTERS = [
  { key: "metrics", letter: "M", label: "Metrics / € case" },
  { key: "eb", letter: "E", label: "Economic Buyer" },
  { key: "criteria", letter: "D", label: "Decision criteria" },
  { key: "process", letter: "D", label: "Decision process" },
  { key: "pain", letter: "I", label: "Identified pain" },
  { key: "champion", letter: "C", label: "Champion" },
] as const;

export interface Template {
  id: string;
  name: string;
  discipline: Discipline;
  stages: string[]; // stages where this template is the expected filing
  description: string;
  fields: TemplateField[];
}

export const TEMPLATES: Template[] = [
  {
    id: "prep",
    name: "Pre-meeting prep",
    discipline: "Sales",
    stages: ["lead"],
    description: "The prep standard before the first meeting. Content, not checkboxes — manager spot-checks before the deal converts to Discovery.",
    fields: [
      { id: "produce", label: "What they produce", kind: "longtext", hint: "Products, lines, throughput. Show you understand the plant." },
      { id: "complexity", label: "Production complexity — background", kind: "longtext", hint: "Input variability, process steps, where operator judgment matters." },
      { id: "attendees", label: "Attendees — role & background", kind: "longtext", hint: "Name, role, what they care about, LinkedIn notes." },
      { id: "news", label: "Recent company news", kind: "longtext", hint: "Announcements, results, investments, regulation hitting them." },
      { id: "agenda", label: "Agenda sent, with hypotheses", kind: "longtext", hint: "The 2-3 hypotheses we want to validate in the meeting." },
      { id: "success_def", label: "Meeting success defined, in writing", kind: "longtext", satisfiesGate: "prep_filed", hint: "What must be true after the meeting for it to have been worth it." },
      { id: "meeting_date", label: "First meeting date", kind: "date", satisfiesGate: "meeting_booked" },
    ],
  },
  {
    id: "discovery_debrief",
    name: "Discovery debrief",
    discipline: "Sales",
    stages: ["discovery"],
    description: "Filed after every Discovery touch. The insights log feeds the >=3-per-category gate.",
    fields: [
      { id: "attendees", label: "Who was in the room", kind: "text" },
      { id: "core_problem", label: "Core problem (their words)", kind: "longtext", satisfiesGate: "core_problem" },
      { id: "urgency", label: "Why now — urgency", kind: "longtext", satisfiesGate: "urgency" },
      { id: "icp_fit", label: "ICP structural fit confirmed", kind: "check", satisfiesGate: "icp_fit" },
      { id: "champion", label: "Champion candidate (name, role)", kind: "text", satisfiesGate: "champion_candidate" },
      { id: "insights", label: "Insights captured (per category)", kind: "longtext", satisfiesGate: "insights_3" },
      { id: "next_step", label: "Agreed structured next step", kind: "text", satisfiesGate: "structured_next_step" },
      { id: "next_meeting", label: "Next meeting date", kind: "date", satisfiesGate: "next_meeting" },
    ],
  },
  {
    id: "meddic_snapshot",
    name: "MEDDIC snapshot",
    discipline: "Sales",
    stages: ["solution_validation", "poc", "negotiation"],
    description: "The deal snapshot — the common language across sellers. Each letter gets the state, a 1-5 score and the gap. Refreshing it stamps MEDDIC Last Reviewed (CP1/CP2/CP3).",
    fields: [
      { id: "metrics", label: "State", kind: "longtext", group: "M — Metrics", hint: "The € / hours / % case. 5 = quantified in € and validated by the customer." },
      { id: "metrics_score", label: "Score", kind: "select", options: ["1", "2", "3", "4", "5"], group: "M — Metrics" },
      { id: "metrics_gap", label: "Gap", kind: "text", group: "M — Metrics" },
      { id: "eb", label: "State", kind: "longtext", group: "E — Economic Buyer", hint: "Name, role, engaged or not. 5 = direct relationship, signs the ARR." },
      { id: "eb_score", label: "Score", kind: "select", options: ["1", "2", "3", "4", "5"], group: "E — Economic Buyer" },
      { id: "eb_gap", label: "Gap", kind: "text", group: "E — Economic Buyer" },
      { id: "criteria", label: "State", kind: "longtext", group: "D — Decision criteria", hint: "5 = ranked and confirmed by the buyer, with a € threshold for success." },
      { id: "criteria_score", label: "Score", kind: "select", options: ["1", "2", "3", "4", "5"], group: "D — Decision criteria" },
      { id: "criteria_gap", label: "Gap", kind: "text", group: "D — Decision criteria" },
      { id: "process", label: "State", kind: "longtext", group: "D — Decision process", satisfiesGate: "arr_decision", hint: "POC path AND the ARR paper process. 5 = both mapped with dates." },
      { id: "process_score", label: "Score", kind: "select", options: ["1", "2", "3", "4", "5"], group: "D — Decision process" },
      { id: "process_gap", label: "Gap", kind: "text", group: "D — Decision process" },
      { id: "pain", label: "State", kind: "longtext", group: "I — Identified pain", hint: "5 = pain in money and personal to a named stakeholder." },
      { id: "pain_score", label: "Score", kind: "select", options: ["1", "2", "3", "4", "5"], group: "I — Identified pain" },
      { id: "pain_gap", label: "Gap", kind: "text", group: "I — Identified pain" },
      { id: "champion", label: "State", kind: "longtext", group: "C — Champion", satisfiesGate: "champion_confirmed", hint: "5 = multi-threaded, proven track record taking pilots to production." },
      { id: "champion_score", label: "Score", kind: "select", options: ["1", "2", "3", "4", "5"], group: "C — Champion" },
      { id: "champion_gap", label: "Gap", kind: "text", group: "C — Champion" },
      { id: "verdict", label: "Verdict — one honest line", kind: "longtext", group: "Overall" },
      { id: "acv", label: "ACV (EUR)", kind: "currency", group: "Overall" },
      { id: "close_target", label: "Close target", kind: "date", group: "Overall" },
      { id: "next_step", label: "Next step", kind: "text", group: "Overall" },
      { id: "blocker", label: "Blocker", kind: "text", group: "Overall" },
    ],
  },
  {
    id: "solval_update",
    name: "Solution Validation update",
    discipline: "Sales",
    stages: ["solution_validation"],
    description: "Pre-POC alignment progress: use cases, success criteria, scope, decision mapping, pricing.",
    fields: [
      { id: "use_cases", label: "Use cases agreed (~3)", kind: "longtext", satisfiesGate: "use_cases" },
      { id: "success_criteria", label: "Success criteria co-signed (Champion + EB)", kind: "check", satisfiesGate: "success_criteria" },
      { id: "poc_scope", label: "POC scope + 10-week timeline agreed", kind: "check", satisfiesGate: "poc_scope" },
      { id: "poc_decision", label: "POC budget owner (EUR 25K)", kind: "text", satisfiesGate: "poc_decision" },
      { id: "decision_driver", label: "Decision driver (Hours / % / EUR)", kind: "select", options: ["Hours", "%", "EUR"], satisfiesGate: "decision_driver" },
      { id: "arr_pricing", label: "ARR pricing range socialised", kind: "check", satisfiesGate: "arr_pricing" },
      { id: "notes", label: "Notes", kind: "longtext" },
    ],
  },
  {
    id: "poc_update",
    name: "POC weekly update",
    discipline: "I&S",
    stages: ["poc"],
    description: "Filed weekly by the Forward Engineer during the 10-week Oppr Lite build.",
    fields: [
      { id: "week", label: "POC week #", kind: "number" },
      { id: "substatus", label: "Sub-status", kind: "select", options: ["Offer Sent", "Offer Signed", "POC Active", "POC Validated"] },
      { id: "adoption", label: "Adoption (% operators logging)", kind: "number" },
      { id: "milestones", label: "Milestones hit / missed", kind: "longtext" },
      { id: "value_signal", label: "EUR value signal observed", kind: "currency" },
      { id: "blocker", label: "Blocker", kind: "text" },
      { id: "next", label: "Next week", kind: "text" },
    ],
  },
  {
    id: "nego_update",
    name: "Negotiation update",
    discipline: "Sales",
    stages: ["negotiation"],
    description: "Procurement runway: controlling, legal, pricing, signature path, close plan.",
    fields: [
      { id: "controlling", label: "Controlling approved", kind: "check", satisfiesGate: "controlling" },
      { id: "legal", label: "Legal docs status (DPA/NDA/SLA/Master)", kind: "text" },
      { id: "pricing", label: "Final pricing (EUR ARR)", kind: "currency", satisfiesGate: "final_pricing" },
      { id: "signature", label: "Signature path confirmed", kind: "check", satisfiesGate: "signature_path" },
      { id: "close_plan", label: "Mutual close-plan date", kind: "date", satisfiesGate: "close_plan" },
      { id: "notes", label: "Notes", kind: "longtext" },
    ],
  },
  {
    id: "campaign_touch",
    name: "Campaign / account touch",
    discipline: "Marketing",
    stages: ["lead", "discovery"],
    description: "ABM play against a named account: channel, engagement, what sourced the lead.",
    fields: [
      { id: "channel", label: "Channel", kind: "select", options: ["LinkedIn outbound", "Event", "Content", "Referral", "Website"] },
      { id: "play", label: "Play / hook used", kind: "longtext" },
      { id: "engagement", label: "Engagement", kind: "select", options: ["Cold", "Engaged", "Meeting agreed"] },
      { id: "next_play", label: "Next play", kind: "text" },
    ],
  },
  {
    id: "disposition",
    name: "Disposition (Stagnate / Lose)",
    discipline: "Sales",
    stages: ["lead", "discovery", "solution_validation", "poc", "negotiation"],
    description: "Park or kill a deal. Stagnated keeps a reactivation date and stays on the monthly watch-list.",
    fields: [
      { id: "kind", label: "Disposition", kind: "select", options: ["Stagnated", "Closed Lost"] },
      { id: "reason", label: "Reason", kind: "select", options: ["Frozen budget", "Vendor processing", "EB / leadership change", "Doing it themselves", "No EB access", "No urgency", "Lost to competitor", "Pricing", "Internal blocker (ERP/MES)", "Other"] },
      { id: "detail", label: "Detail", kind: "longtext" },
      { id: "reactivation", label: "Reactivation date (if Stagnated)", kind: "date" },
    ],
  },
];

export const TEMPLATE_BY_ID: Record<string, Template> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t])
);

// ============================================================================
// Event model — the record card is an append-only event log.
// ============================================================================

export interface DealEvent {
  at: string; // ISO date "2026-03-14"
  author: string;
  discipline: Discipline;
  type: "template" | "stage" | "gate" | "note" | "flag";
  templateId?: string;
  payload?: Record<string, unknown>;
  note?: string;
  gatesSatisfied?: string[];
  from?: string; // stage moves
  to?: string;
  override?: boolean; // moved past unmet gates — leaves a visible flag
  attachments?: { storageId: string; name: string; mime: string; url?: string | null }[];
  // Per-field provenance. Old events may hold the bare string form.
  provenance?: Record<string, ProvenanceKind | ProvenanceInfo>;
  // Verbatim pasted notes — the root evidence behind extracted values.
  evidenceText?: string;
}

export type ProvenanceKind = "manual" | "ai" | "ai-edited";
export interface ProvenanceInfo {
  kind: ProvenanceKind;
  quote?: string; // the evidence fragment the AI based the value on
}

export function provInfo(
  prov: Record<string, ProvenanceKind | ProvenanceInfo> | undefined,
  fieldId: string
): ProvenanceInfo | null {
  const raw = prov?.[fieldId];
  if (!raw) return null;
  return typeof raw === "string" ? { kind: raw } : raw;
}

export const SIM_START = "2026-01-05";
export const SIM_TODAY = "2026-06-09";

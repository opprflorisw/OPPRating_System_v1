// ============================================================================
// The Library — every commercial standard in one place. Sourced from the
// sales workshop with Lars: playbook, sales process, MEDDIC review standard,
// EliteGTM frameworks (3Ys, Value Hypothesis), email & meeting templates.
// Static reference for now; the live filing templates are in pipeline.ts.
// ============================================================================

export interface EmailTemplate {
  id: string;
  name: string;
  when: string;
  subject: string;
  body: string;
  notes: string[];
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "outreach_hook",
    name: "LinkedIn outreach — the hook",
    when: "Step 1 · first contact with Operations (Ops Exec / Ops Manager)",
    subject: "(LinkedIn message, no subject)",
    body:
      "Hi [name] — you run [site/line] at [company]. Working with other waste operators we typically improve [doorzet / availability / recyclate recovery] by ~10% by capturing what your senior operators see and hear before the dashboards do.\n\n" +
      "We've a few hypotheses on [line/process] I'd like to test with you. Open to a 15–20 min call this or next week?",
    notes: [
      "Come in with 2-3 high-level hypotheses from similar companies.",
      "Goal: spark interest, propose a short 15–30 min call. Nothing else.",
      "Anchor on EPR + CO2-levy economics where it fits the operator.",
    ],
  },
  {
    id: "use_case_email",
    name: "Post-intro-call — Problem / Use-case email",
    when: "Step 2 · after the 15–30 min pain-confirmation call",
    subject: "[Company] — what we heard, and 3–5 places Oppr would bite",
    body:
      "[Name], thanks for the open conversation.\n\n" +
      "What we heard: [core problem in their words]. Today that costs you [value / comparison: hours, %, EUR].\n\n" +
      "Based on the call, the use cases we would start with:\n" +
      "• [Use case 1 — tied to a pain they named]\n" +
      "• [Use case 2]\n" +
      "• [Use case 3 — optionally 4 and 5]\n\n" +
      "Next step: a site visit where we show this working on your own case. Worth bringing [operations leader / relevant stakeholders] into the room.\n\n" +
      "To personalise the demo, could you share: [pick from the info-request list].",
    notes: [
      "Short but packed: ~3 bullets, ~2 short paragraphs.",
      "Show value, show a comparison. The 3–5 use cases are the heart.",
      "Suggest involving other stakeholders for the demo where it makes sense.",
    ],
  },
  {
    id: "recap_email",
    name: "Post-site-visit — recap email",
    when: "Step 3 · same day as the site-visit demo",
    subject: "[Company] site visit — recap, PoC flow and next steps",
    body:
      "[Name], thanks for today.\n\n" +
      "What we agreed: [the use cases validated in the room]. Success looks like [their words].\n\n" +
      "The PoC is a means to an end — it de-risks the yearly contract by proving time-to-value on [line]. Standard flow: 10 weeks, collect → analyse → implement, EUR 25K.\n\n" +
      "Stakeholders short & long term: [who's involved]. For the yearly decision we understood [Economic Buyer / process] — please correct us.\n\n" +
      "One ask to keep the pace: can we get procurement involved now? The more clarity early, the faster your time-to-value.\n\n" +
      "Next steps: [dates].",
    notes: [
      "Identify the Economic Buyer here — keep it light in the room, make it explicit in the email.",
      "Principles to land: alternative to today, time-to-value, PoC = stepping stone, procurement early.",
    ],
  },
];

export const INFO_REQUEST_LIST = [
  "Use case",
  "Machines",
  "KPIs / metrics",
  "Process description",
  "Process flow",
  "Floor plan",
  "Equipment info",
];

export const SITE_VISIT_AGENDA = [
  "Introduction & roundtable — confirm who's in the room; our understanding of their use case + war stories (show the homework).",
  "Demo — prepared, personalised on their case.",
  "Vision of Oppr — the 3 tools; the PoC as a stepping stone, digestible into a quick ROI.",
  "Feedback & confirmation — does this align with what they're doing?",
  "We work only with genuinely interested companies — the EUR 25K PoC is how we showcase value.",
  "PoC = stepping stone to the full contract. Ask about past projects; identify stakeholders and the Economic Buyer (light in the room, explicit in the recap email).",
  "Next steps — recap email, share the info deck, the 10-week PoC flow (collect → analyse → implement), high level.",
  "Closing — define the steps after PoC go-ahead.",
];

export const THREE_WHYS = {
  title: "Three Whys (3Ys) — discovery pre-work",
  description:
    "Framing prepared BEFORE the customer discussion. One per deal. Digitised from the EliteGTM template.",
  header: "Strategic Business Priority — the key business priority or initiative",
  columns: [
    { why: "Why Anything?", rows: ["Current Challenges", "Measured Impact"] },
    { why: "Why Oppr?", rows: ["Solution Requirements", "Solution Alignment"] },
    { why: "Why Now?", rows: ["Desired State", "Expected Outcomes"] },
  ],
};

export const VALUE_HYPOTHESIS = {
  title: "Value Hypothesis — 'Our understanding of your business'",
  description:
    "A pre-read that proves we understand the account before we pitch. Five stacked sections (EliteGTM, layout option 4).",
  rows: [
    { label: "Organizational Vision", guide: "Company vision, project objective or CEO initiative." },
    { label: "Supporting Objectives", guide: "Top 3 business objectives driving BUSINESS outcomes." },
    { label: "Strategic Initiatives", guide: "Tech/ops initiatives aligned to solutions." },
    { label: "Risks & Challenges", guide: "The risk of not executing, or critical capabilities needed." },
    { label: "Solution Requirements", guide: "The solution elements that solve their pain points." },
  ],
};

// What 1 / 3 / 5 looks like per MEDDIC letter — distilled from the Attero
// review standard so scores mean the same thing across sellers.
export const MEDDIC_RUBRIC: { key: string; letter: string; label: string; low: string; mid: string; high: string }[] = [
  {
    key: "metrics", letter: "M", label: "Metrics",
    low: "Vague benefit talk. No baseline.",
    mid: "Operational baseline with today-vs-target gaps, but no translation to EUR and targets not committed by the customer.",
    high: "Quantified in EUR, assumptions validated by the customer, tied to the lever Oppr controls.",
  },
  {
    key: "eb", letter: "E", label: "Economic Buyer",
    low: "Unknown, or assumed to be the champion.",
    mid: "Named, briefed via the champion, but not spoken to directly; authority/threshold unconfirmed.",
    high: "Direct relationship. Authority and threshold confirmed. The ARR-level signer is known and engaged.",
  },
  {
    key: "criteria", letter: "D", label: "Decision criteria",
    low: "Not discussed.",
    mid: "Hypothesised from conversations, not ranked or confirmed by the buyer. No EUR threshold for success.",
    high: "Ranked, confirmed by the buyer, with an agreed EUR threshold that defines a successful PoC.",
  },
  {
    key: "process", letter: "D", label: "Decision process",
    low: "No idea how a contract gets signed.",
    mid: "PoC path clear; approval threshold, procurement and IT/InfoSec TBD; the ARR paper process unmapped.",
    high: "Both PoC and ARR paths mapped with names, thresholds and dates. Procurement and IT engaged early.",
  },
  {
    key: "pain", letter: "I", label: "Identified pain",
    low: "Generic industry pain.",
    mid: "Technical pain sharp, but not in money and not personal to a named stakeholder. Urgency abstract.",
    high: "Pain in EUR and personal — a named person owns the red KPI and feels it. Urgency anchored to accountability.",
  },
  {
    key: "champion", letter: "C", label: "Champion",
    low: "A friendly contact.",
    mid: "Strong single thread: hosts visits, briefs the EB, authors internal documents. But single-threaded; power over operations, not the contract.",
    high: "Multi-threaded, tested (has taken pilots to production), actively selling internally with our materials.",
  },
];

export const MEDDIC_STANDARD_NOTES = [
  "Each sales executive maintains the MEDDIC snapshot per deal — the state of the deal at a point in time.",
  "Repeated over time, snapshots show how each prospect progresses and where the recurring gaps sit across the team.",
  "The sales leader reviews all snapshots weekly, tracks outstanding items, and coaches on the gaps.",
  "Worked example: Attero review 2026-06-01 — 17.5/30 (58%, C+): 'winning the PoC, under-building the deal'. The classic PoC trap: everyone happy, no signature, because nobody agreed what a win was worth.",
];

export const PRINCIPLES = [
  "We create an alternative to what they do today — the real competitor is status quo / do-it-yourself.",
  "Focus hard on time-to-value; make it easy for the champion to sell internally.",
  "The PoC is a means to an end — the end is a large ACV. The PoC de-risks by surfacing blockers.",
  "Closed Won = signed yearly ARR contract. POC and implementation fees are not wins.",
  "Get procurement involved as early as the customer allows.",
];

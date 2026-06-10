// ============================================================================
// Seeders for the Knowledge System.
// - seedGeneral: the methodology tier, derived from library.ts (canonical).
//   Idempotent — it replaces all source:"seeded" general nodes each run.
// - seedSim: a curated client + vertical demo graph for the Simulation
//   workspace, so the full three-tier learning loop is demoable and resettable.
// ============================================================================

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { MEDDIC_RUBRIC, PRINCIPLES, EMAIL_TEMPLATES, SITE_VISIT_AGENDA, THREE_WHYS, VALUE_HYPOTHESIS } from "./library";
import { SIM_TODAY } from "./pipeline";
import { DEFAULT_VERTICALS } from "./verticals";
import { ensureClientsInner } from "./migrations";

const nowISO = () => new Date().toISOString();

// ── General tier ────────────────────────────────────────────────────────────

async function wipeSeededGeneral(ctx: MutationCtx) {
  const general = await ctx.db
    .query("knowledge")
    .withIndex("by_workspace", (q) => q.eq("workspace", "shared"))
    .collect();
  const seeded = general.filter((n) => n.source === "seeded");
  const ids = new Set(seeded.map((n) => n._id));
  const edges = await ctx.db.query("knowledgeEdges").collect();
  for (const e of edges) {
    if (ids.has(e.source) || ids.has(e.target)) await ctx.db.delete(e._id);
  }
  for (const n of seeded) await ctx.db.delete(n._id);
}

export async function seedGeneralInner(ctx: MutationCtx): Promise<{ nodes: number }> {
  await wipeSeededGeneral(ctx);
  const at = nowISO();
  const ids: Record<string, Id<"knowledge">> = {};

  const add = async (
    key: string,
    type: string,
    title: string,
    claim: string,
    detail?: string,
    tags?: string[]
  ) => {
    ids[key] = await ctx.db.insert("knowledge", {
      workspace: "shared",
      scopeLevel: "general",
      type,
      title,
      claim,
      detail,
      confidence: 1.0,
      status: "active",
      source: "seeded",
      tags: ["seed", ...(tags ?? [])],
      createdAt: at,
      lastConfirmedAt: at,
    });
  };
  const link = async (a: string, b: string, type: string) => {
    if (ids[a] && ids[b]) await ctx.db.insert("knowledgeEdges", { source: ids[a], target: ids[b], type, createdAt: at });
  };

  // MEDDIC rubric — one standard per letter.
  for (const r of MEDDIC_RUBRIC) {
    await add(
      `meddic_${r.key}`,
      "standard",
      `MEDDIC ${r.letter} — ${r.label}`,
      `${r.letter} ${r.label}: a strong (4-5) state means ${r.high}`,
      `1-2 = ${r.low}\n3 = ${r.mid}\n4-5 = ${r.high}`,
      ["meddic", r.key]
    );
  }
  // The snapshot cadence standard, ties the rubric together.
  await add(
    "meddic_cadence",
    "standard",
    "MEDDIC snapshot cadence",
    "Each seller maintains a MEDDIC snapshot per deal; the leader reviews weekly and coaches the recurring gaps. Score honestly — a 2 with a plan beats a flattering 4.",
    "Worked example: Attero review 17.5/30 (58%, C+) — 'winning the PoC, under-building the deal'.",
    ["meddic"]
  );
  for (const r of MEDDIC_RUBRIC) await link("meddic_cadence", `meddic_${r.key}`, "relates_to");

  // Principles — doctrine standards.
  for (let i = 0; i < PRINCIPLES.length; i++) {
    await add(`principle_${i}`, "standard", `Principle ${i + 1}`, PRINCIPLES[i], undefined, ["principle"]);
  }

  // Email templates — plays.
  for (const t of EMAIL_TEMPLATES) {
    await add(`email_${t.id}`, "play", t.name, `${t.name} — ${t.when}`, t.notes.join("\n"), ["email"]);
  }
  // Site visit, 3Ys, value hypothesis.
  await add("site_visit", "play", "Site-visit agenda", "Homework-led demo on their own case; PoC as a stepping stone; identify the Economic Buyer (light in the room, explicit in the recap).", SITE_VISIT_AGENDA.join("\n"), ["meeting"]);
  await add("three_whys", "standard", THREE_WHYS.title, THREE_WHYS.description, undefined, ["discovery", "elitegtm"]);
  await add("value_hypothesis", "standard", VALUE_HYPOTHESIS.title, VALUE_HYPOTHESIS.description, undefined, ["discovery", "elitegtm"]);

  // A few connective edges so the methodology graph reads as a graph.
  await link("email_outreach_hook", "principle_0", "relates_to"); // alternative to status quo
  await link("email_recap_email", "principle_4", "relates_to"); // procurement early
  await link("site_visit", "principle_2", "relates_to"); // PoC is a means to an end
  await link("three_whys", "value_hypothesis", "relates_to");
  await link("email_use_case_email", "three_whys", "relates_to");

  const all = await ctx.db.query("knowledge").withIndex("by_workspace", (q) => q.eq("workspace", "shared")).collect();
  return { nodes: all.filter((n) => n.source === "seeded").length };
}

export const seedGeneral = mutation({
  args: {},
  handler: async (ctx) => seedGeneralInner(ctx),
});

// ── Sim demo tier (client + vertical), resettable ───────────────────────────

export async function wipeSimKnowledgeInner(ctx: MutationCtx) {
  const sim = await ctx.db
    .query("knowledge")
    .withIndex("by_workspace", (q) => q.eq("workspace", "sim"))
    .collect();
  const ids = new Set(sim.map((n) => n._id));
  const edges = await ctx.db.query("knowledgeEdges").collect();
  for (const e of edges) {
    if (ids.has(e.source) || ids.has(e.target)) await ctx.db.delete(e._id);
  }
  for (const n of sim) await ctx.db.delete(n._id);
}

export async function seedSimInner(ctx: MutationCtx): Promise<{ nodes: number }> {
  await wipeSimKnowledgeInner(ctx);
  const fresh = SIM_TODAY; // most facts confirmed "today"
  const old = "2026-02-12"; // one intentionally stale fact for the demo

  const clientByName = async (name: string): Promise<Id<"clients"> | null> => {
    const c = await ctx.db
      .query("clients")
      .withIndex("by_workspace_name", (q) => q.eq("workspace", "sim").eq("name", name))
      .first();
    return c?._id ?? null;
  };

  const node = async (
    clientId: Id<"clients"> | null,
    scopeLevel: "client" | "vertical",
    type: string,
    title: string,
    claim: string,
    opts?: { detail?: string; confidence?: number; status?: string; at?: string; tags?: string[] }
  ): Promise<Id<"knowledge">> => {
    const at = opts?.at ?? fresh;
    return await ctx.db.insert("knowledge", {
      workspace: "sim",
      scopeLevel,
      vertical: "waste",
      clientId: clientId ?? undefined,
      type,
      title,
      claim,
      detail: opts?.detail,
      confidence: opts?.confidence ?? 0.8,
      status: opts?.status ?? "active",
      source: scopeLevel === "client" ? "extracted" : "promoted",
      tags: opts?.tags,
      createdAt: at,
      lastConfirmedAt: at,
    });
  };
  const edge = async (s: Id<"knowledge">, t: Id<"knowledge">, type: string) =>
    void (await ctx.db.insert("knowledgeEdges", { source: s, target: t, type, createdAt: fresh }));

  let count = 0;
  const sourceForPromotion: Id<"knowledge">[] = [];

  // ── Attero (the richest sim client) ──
  const attero = await clientByName("Attero");
  if (attero) {
    const champ = await node(attero, "client", "stakeholder", "Charles de Wolff (champion)",
      "Charles de Wolff — Ops Manager EfW Wijster. The champion: requested the demo himself, strong political capital, briefs internally.",
      { confidence: 0.9, detail: "Pressure-test still open: has he taken a pilot to production before?" });
    const eb = await node(attero, "client", "stakeholder", "Carla Schambach (EB-side)",
      "Carla Schambach holds PoC signing authority and prepared the overeenkomst — briefed via the champion, not yet engaged directly. The ARR-level signer is still unconfirmed.",
      { confidence: 0.6 });
    const pain = await node(attero, "client", "pain", "Plastics in RDF burn twice",
      "Plastics in the RDF stream burn twice: Attero pays the CO2 levy on them AND loses the recyclate value, focused on Lijn 13.",
      { confidence: 0.9 });
    const metric = await node(attero, "client", "metric", "CO2 levy curve",
      "Value case anchored on the CO2-heffing climbing to €136.79/t by 2030; waste-tax reform on top.", { confidence: 0.85 });
    const proc = await node(attero, "client", "process_fact", "PoC paper signed, ARR path unmapped",
      "PoC budget (€25K) signed by Carla Schambach via the overeenkomst; the yearly ARR paper process (IC, thresholds, signers) is still unmapped.", { confidence: 0.7 });
    const obj = await node(attero, "client", "objection", "Procurement dragging",
      "Procurement / vendor onboarding is dragging after a validated PoC — the classic PoC-to-ARR gap.",
      { confidence: 0.75, at: old });
    await edge(pain, champ, "about");
    await edge(metric, pain, "validates");
    await edge(obj, proc, "blocks");
    sourceForPromotion.push(proc, obj);
    count += 6;
  }

  // ── Renewi ──
  const renewi = await clientByName("Renewi");
  if (renewi) {
    await node(renewi, "client", "pain", "Sorting purity vs offtake price",
      "Recyclate offtake price swings with sorting purity; operators can't see purity drift until the lab result lands days later.", { confidence: 0.7 });
    const r_proc = await node(renewi, "client", "process_fact", "ARR path unmapped at SolVal",
      "Entered Solution Validation with the PoC path clear but the ARR paper process unmapped — same shape as Attero.", { confidence: 0.65 });
    sourceForPromotion.push(r_proc);
    count += 2;
  }

  // ── HVC (municipal-owned) ──
  const hvc = await clientByName("HVC");
  if (hvc) {
    await node(hvc, "client", "stakeholder", "Municipal shareholder structure",
      "HVC is owned by municipalities and waterboards — procurement is formal and slow; budget rhythm follows the public-sector calendar.", { confidence: 0.7 });
    const h_obj = await node(hvc, "client", "objection", "Long vendor onboarding",
      "Vendor onboarding runs for weeks through formal municipal procurement — must start in parallel with the PoC.", { confidence: 0.7 });
    sourceForPromotion.push(h_obj);
    count += 2;
  }

  // ── AVR ──
  const avr = await clientByName("AVR");
  if (avr) {
    await node(avr, "client", "pain", "Boiler fouling from feedstock variability",
      "Unpredictable feedstock drives boiler fouling and unplanned downtime; operators hold the early signal before sensors do.", { confidence: 0.7 });
    count += 1;
  }

  // ── Vertical: active waste lessons (the cross-client tier) ──
  await node(null, "vertical", "lesson", "Anchor ROI on the levy curve",
    "Waste & WtE operators anchor ROI on the CO2 levy curve (→ €137/t by 2030) and EPR economics. Lead every value case in that currency.",
    { confidence: 0.9 });
  await node(null, "vertical", "lesson", "The WtE PoC trap",
    "The PoC trap is acute in WtE: operations improve, everyone's happy, but nobody agreed what a win was worth — so no signature. Co-sign success criteria with the EB before the PoC, on metrics Oppr controls.",
    { confidence: 0.9 });
  await node(null, "vertical", "play", "Demo on their own line data",
    "A site-visit demo personalised on the operator's own line data (input characterisation) reliably converts to a paid PoC.",
    { confidence: 0.85 });
  await node(null, "vertical", "lesson", "Run procurement in parallel",
    "At municipal-owned operators (HVC, AVR, Twence) vendor onboarding takes weeks — run it in parallel with the PoC, never after.",
    { confidence: 0.8 });
  count += 4;

  // ── Proposed promotions (the review-queue demo) ──
  const prop1 = await node(null, "vertical", "lesson", "PROPOSED: ARR paper unmapped at PoC",
    "Multiple waste operators stalled at the PoC→ARR handoff because the yearly paper process was left unmapped during Solution Validation. Map the ARR signers and thresholds before the PoC, not after.",
    { confidence: 0.7, status: "proposed" });
  for (const sid of sourceForPromotion) await edge(prop1, sid, "generalized_from");
  const prop2 = await node(null, "vertical", "play", "PROPOSED: say the yearly number early",
    "Naming the yearly ARR number out loud before the PoC starts surfaces pricing blockers early — observed at 2 accounts.",
    { confidence: 0.65, status: "proposed" });
  count += 2;
  void prop2;

  return { nodes: count };
}

export const seedSim = mutation({
  args: {},
  handler: async (ctx) => seedSimInner(ctx),
});

// One-call foundation: seed verticals, backfill clients, seed the general
// methodology graph, and (for sim) the demo client/vertical graph. Idempotent.
export const setup = mutation({
  args: { workspace: v.optional(v.string()) },
  handler: async (ctx, { workspace }) => {
    for (const vrt of DEFAULT_VERTICALS) {
      const existing = await ctx.db.query("verticals").withIndex("by_vid", (q) => q.eq("vid", vrt.vid)).first();
      if (!existing) await ctx.db.insert("verticals", vrt);
    }
    const linked = await ensureClientsInner(ctx, "waste");
    const general = await seedGeneralInner(ctx);
    let sim = { nodes: 0 };
    if ((workspace ?? "sim") === "sim") sim = await seedSimInner(ctx);
    return { ...linked, generalNodes: general.nodes, simNodes: sim.nodes };
  },
});

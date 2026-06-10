// ============================================================================
// Knowledge System — shared ontology. The single source of truth for node and
// edge types, used by the Convex backend (extraction, serialization) and the
// React frontend (graph visualization). Mirrors docs/knowledge-system-design.md.
// ============================================================================

export type KnowledgeScope = "general" | "vertical" | "client";
export type KnowledgeStatus = "active" | "proposed" | "superseded" | "rejected";
export type KnowledgeSource = "seeded" | "extracted" | "promoted" | "manual";

export type NodeType =
  | "stakeholder"
  | "pain"
  | "metric"
  | "objection"
  | "process_fact"
  | "lesson"
  | "play"
  | "standard";

export interface NodeTypeDef {
  type: NodeType;
  label: string;
  color: string;
  what: string;
}

// Order matters: drives legend + serialization grouping.
export const NODE_TYPES: NodeTypeDef[] = [
  { type: "stakeholder", label: "Stakeholder", color: "#2563eb", what: "A person/role: power, disposition, thread strength" },
  { type: "pain", label: "Pain", color: "#dc2626", what: "An identified pain, ideally in EUR, with an owner" },
  { type: "metric", label: "Metric", color: "#0891b2", what: "A baseline/target the value case is built on" },
  { type: "objection", label: "Objection", color: "#d97706", what: "A raised objection/risk and its handling state" },
  { type: "process_fact", label: "Process fact", color: "#7c3aed", what: "Decision/procurement process knowledge" },
  { type: "lesson", label: "Lesson", color: "#16a34a", what: "A learned generalization (the promotable type)" },
  { type: "play", label: "Play", color: "#db2777", what: "A tactic/move that works (or doesn't)" },
  { type: "standard", label: "Standard", color: "#475569", what: "Seeded doctrine from the operating manual / library" },
];

export const NODE_TYPE_SET = new Set<string>(NODE_TYPES.map((n) => n.type));
export const NODE_COLOR: Record<string, string> = Object.fromEntries(
  NODE_TYPES.map((n) => [n.type, n.color])
);
export const NODE_LABEL: Record<string, string> = Object.fromEntries(
  NODE_TYPES.map((n) => [n.type, n.label])
);

export type EdgeType =
  | "relates_to"
  | "about"
  | "blocks"
  | "validates"
  | "supersedes"
  | "generalized_from"
  | "refines";

export const EDGE_TYPES: EdgeType[] = [
  "relates_to", "about", "blocks", "validates", "supersedes", "generalized_from", "refines",
];
export const EDGE_TYPE_SET = new Set<string>(EDGE_TYPES);

export const SCOPE_LABEL: Record<KnowledgeScope, string> = {
  general: "General (methodology)",
  vertical: "Vertical",
  client: "Client",
};

// How long before an unconfirmed client/vertical fact is flagged stale.
export const STALE_DAYS = 60;

export function daysBetweenISO(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function isStale(lastConfirmedAt: string, asOf: string): boolean {
  return daysBetweenISO(lastConfirmedAt, asOf) > STALE_DAYS;
}

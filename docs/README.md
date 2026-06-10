# OPPRating System — Design Docs

Planning and architecture documents for the OPPRating pipeline tool.

## The Knowledge System (layered, evolving knowledge graphs)

A three-tier knowledge graph — **General** (methodology) → **Vertical** (per industry)
→ **Client** (per account) — that learns automatically from filed deal events, promotes
lessons upward through a human review gate, and serves the right knowledge to every AI
feature depending on where the user is in the tool.

- **[knowledge-system-design.md](./knowledge-system-design.md)** — the complete design:
  10 resolved decisions (each with rejected alternatives), the typed ontology (8 node
  types, 7 edge types), Convex schema changes, the extraction/promotion/retrieval
  pipelines, seeding, and the showcase UI. *Status: v1, decided 2026-06-10.*
- **[knowledge-system-todo.md](./knowledge-system-todo.md)** — the execution plan: 20
  tasks across 5 build phases (Foundations → Learning loop → Serving → Promotion →
  Showcase) plus an optional backlog, each with the files it touches and a "done when"
  check. *Status: finalized, ready to execute.*

Start with the design doc for the "why", then the to-do for the "how".

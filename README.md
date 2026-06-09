# OPPRating System v1 — Pipeline Machine

The commercial engine of Oppr B.V., run as a real tool. A HubSpot-style pipeline board
that enforces the Pipeline Operating Manual (Lars Grønkjær, June 2026 v1.0): stages,
exit gates, CP1–CP3 MEDDIC checkpoints, override flags, an append-only deal record,
a replayable timeline, a weekly roll-up, and an AI analyst you can ask questions.

All deal data is **simulated** on the real NL priority targets (waste collectors and
WtE operators). The point: see what the machine looks like before building it in HubSpot.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vite + React + TypeScript |
| Database | Convex (deals + append-only events) |
| AI | Google AI (Gemini 2.5 Flash) via a Convex action |
| Hosting | Vercel |

The pipeline definition (stages, gates, templates) lives in `convex/pipeline.ts` and is
the future HubSpot build sheet: stage → pipeline stage, gate → conditional stage
property, template → form / Claude skill, event log → deal timeline.

## First-time setup (run these yourself)

```bash
npm install

# 1. Provision the Convex backend (opens browser to log in, creates the project,
#    pushes the schema, generates convex/_generated, writes .env.local)
npx convex dev
```

Leave `npx convex dev` running. In a second terminal:

```bash
# 2. Give the AI analyst its key (get one free at https://aistudio.google.com/apikey)
npx convex env set GOOGLE_API_KEY <your-key>

# 3. Start the app
npm run dev
```

Open http://localhost:5173 and click **Load the simulated scenario** (seeds the 13 targets).

## Deploy to Vercel

```bash
# Creates a production Convex deployment and prints its URL
npx convex deploy
```

Then on Vercel: import the GitHub repo, framework Vite, and set the env var
`VITE_CONVEX_URL` to the production Convex URL. Build command:
`npx convex deploy --cmd 'npm run build'` (keeps backend and frontend in sync),
or plain `npm run build` if you deploy Convex manually.

Set `GOOGLE_API_KEY` on the **production** Convex deployment too:
`npx convex env set GOOGLE_API_KEY <key> --prod`.

## How to use it

- **Board** — deals at their stage. Cards show health (R/A/G), gate progress,
  days-in-stage (rotting), blockers, forecast category, override flags.
- **Drag a card** one stage forward — the gate check opens. Green gates show their
  evidence (which filed record satisfied them, when). Unmet gates block; you can
  force the move, which stamps a visible ⚑ OVERRIDE flag until the gates are filed.
- **Click a card** — the record card: MEDDIC spine (gaps highlighted), exit gates,
  and the full append-only timeline. File updates or quick notes from here.
- **File an update** — pick the stage template (discovery debrief, MEDDIC snapshot,
  POC weekly, negotiation update, disposition…). Fields marked ⛩ satisfy exit gates
  automatically: the template carries the standard.
- **Replay slider** — scrub January → June 2026 and watch the pipeline state rebuild
  itself from the event logs at any date.
- **Weekly roll-up** — funnel totals, what moved in the last 7 days, deal-level flags
  (EB gaps, stale MEDDIC, rotting, overrides), plus the AI-generated weekly review.
- **Ask the data** — chat dock, bottom right. The Gemini-backed RevOps analyst reads
  every record as of the selected date.

## Reset

**Reset scenario** (top right) wipes all changes and restores the seed data.

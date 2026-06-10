// ============================================================================
// Scheduled jobs. Weekly promotion scan: roll cross-client lessons up into the
// vertical/general tiers as PROPOSALS for human review (never auto-served).
// ============================================================================

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Monday 06:00 UTC — before the week starts.
crons.weekly(
  "weekly knowledge promotion scan",
  { dayOfWeek: "monday", hourUTC: 6, minuteUTC: 0 },
  internal.knowledgePromote.scheduledScan
);

export default crons;

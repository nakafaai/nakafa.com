import { internal } from "@repo/backend/convex/_generated/api";
import { cronJobs } from "convex/server";

const crons = cronJobs();

/**
 * Populates audio generation queue every 30 minutes.
 * Runs in all environments for trending statistics.
 */
crons.interval(
  "populate audio generation queue",
  { minutes: 30 },
  internal.contents.mutations.populateAudioQueue,
  {}
);

/**
 * Processes audio generation queue every 30 minutes.
 * Respects daily limits. Set ENABLE_AUDIO_GENERATION=true in prod.
 */
crons.interval(
  "process audio generation queue",
  { minutes: 45 },
  internal.audioStudies.mutations.startWorkflowsForPendingItems,
  {}
);

/**
 * Cleans up old queue items daily at 2 AM UTC.
 */
crons.cron(
  "cleanup audio generation",
  "0 2 * * *",
  internal.audioStudies.mutations.cleanup,
  {}
);

/**
 * Resets stuck queue items every hour.
 */
crons.interval(
  "reset stuck queue items",
  { minutes: 60 },
  internal.audioStudies.mutations.resetStuckQueueItems,
  {}
);

export default crons;

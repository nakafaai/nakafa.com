import { internal } from "@repo/backend/convex/_generated/api";
import { cronJobs } from "convex/server";

const crons = cronJobs();

/**
 * Content aggregation cron - runs every 30 minutes
 * Populates audioGenerationQueue with high-priority content from aggregate data
 *
 * Note: This runs in ALL environments to maintain statistics for trending features
 */
crons.interval(
  "populate audio generation queue",
  { minutes: 30 },
  internal.contents.mutations.populateAudioQueue,
  {}
);

/**
 * Audio generation queue processing - runs every 30 minutes
 * Starts workflows for pending queue items (respects daily limits)
 *
 * Note: 30 minutes is optimal for the 1-content-per-day strategy:
 * - Responsive enough when daily limit resets (max 30 min delay)
 * - Reduces wasted checks by 83% (48 runs/day vs 288 with 5-minute interval)
 * - The handler checks ENABLE_AUDIO_GENERATION env var at runtime.
 * Set ENABLE_AUDIO_GENERATION=true in prod deployment to enable audio generation.
 * In dev, the handler logs and returns early (no ElevenLabs costs).
 */
crons.interval(
  "process audio generation queue",
  { minutes: 30 },
  internal.audioStudies.mutations.startWorkflowsForPendingItems,
  {}
);

/**
 * Audio generation cleanup - runs daily at 2 AM UTC
 * Removes completed/failed queue items older than retention period
 *
 * Note: This runs in ALL environments for maintenance
 */
crons.cron(
  "cleanup audio generation",
  "0 2 * * *",
  internal.audioStudies.mutations.cleanup,
  {}
);

/**
 * Reset stuck queue items - runs every hour
 * Recovers items stuck in "processing" state (interrupted workflows)
 *
 * Per Convex best practices:
 * - Uses bounded query with take(50) to limit work per run
 * - Non-critical: logs but doesn't throw on issues
 * - Frequent enough to prevent long queue stalls (max 1 hour stuck time)
 */
crons.interval(
  "reset stuck queue items",
  { minutes: 60 },
  internal.audioStudies.mutations.resetStuckQueueItems,
  {}
);

export default crons;

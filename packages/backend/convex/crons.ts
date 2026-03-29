import { internal } from "@repo/backend/convex/_generated/api";
import { IRT_AUTOMATION_CRON_INTERVAL_MINUTES } from "@repo/backend/convex/irt/policy";
import { cronJobs } from "convex/server";

const crons = cronJobs();
const TRYOUT_EXPIRY_SWEEP_INTERVAL_MINUTES = 5;
const TRYOUT_ACCESS_STATUS_SWEEP_INTERVAL_MINUTES = 5;

/**
 * Ensures analytics partition lease rows exist before workers run.
 */
crons.interval(
  "initialize content analytics partitions",
  { minutes: 1 },
  internal.contents.mutations.setup.initializeAnalyticsPartitions,
  {}
);

/**
 * Schedules idle content analytics partitions that have queued rows.
 */
crons.interval(
  "schedule content analytics partitions",
  { minutes: 1 },
  internal.contents.mutations.analytics.scheduleContentAnalyticsPartitions,
  {}
);

/**
 * Populates audio generation queue every 30 minutes.
 */
crons.interval(
  "populate audio generation queue",
  { minutes: 30 },
  internal.contents.actions.queue.populateAudioQueue,
  {}
);

/**
 * Processes audio generation queue every 30 minutes.
 * Respects daily limits. Set ENABLE_AUDIO_GENERATION=true in prod.
 */
crons.interval(
  "process audio generation queue",
  { minutes: 45 },
  internal.audioStudies.mutations.queue.startWorkflowsForPendingItems,
  {}
);

/**
 * Cleans up old queue items daily at 2 AM UTC.
 */
crons.cron(
  "cleanup audio generation",
  "0 2 * * *",
  internal.audioStudies.mutations.queue.cleanup,
  {}
);

/**
 * Resets stuck queue items every hour.
 */
crons.interval(
  "reset stuck queue items",
  { minutes: 60 },
  internal.audioStudies.mutations.queue.resetStuckQueueItems,
  {}
);

/**
 * Resets free user credits daily at midnight UTC.
 * Populates queue and starts parallel workers.
 */
crons.cron(
  "reset free user credits",
  "0 0 * * *",
  internal.credits.actions.populateQueue,
  { plan: "free" }
);

/**
 * Resets pro user credits monthly on 1st at midnight UTC.
 * Populates queue and starts parallel workers.
 */
crons.cron(
  "reset pro user credits",
  "0 0 1 * *",
  internal.credits.actions.populateQueue,
  { plan: "pro" }
);

/**
 * Cleans up old credit reset queue items daily at 3 AM UTC.
 */
crons.cron(
  "cleanup credit reset queue",
  "0 3 * * *",
  internal.credits.mutations.cleanupOldQueueItems,
  {}
);

/**
 * Starts queued IRT calibrations in bounded batches.
 */
crons.interval(
  "drain irt calibration queue",
  { minutes: IRT_AUTOMATION_CRON_INTERVAL_MINUTES },
  internal.irt.mutations.internal.queue.drainCalibrationQueue,
  {}
);

/**
 * Publishes queued tryout scale versions in bounded batches.
 */
crons.interval(
  "drain irt scale publication queue",
  { minutes: IRT_AUTOMATION_CRON_INTERVAL_MINUTES },
  internal.irt.mutations.internal.scales.drainScalePublicationQueue,
  {}
);

/**
 * Refreshes persisted IRT scale quality summaries in bounded batches.
 */
crons.cron(
  "rebuild irt scale quality checks",
  "0 */6 * * *",
  internal.irt.mutations.internal.scales.rebuildScaleQualityChecksPage,
  {}
);

/**
 * Repairs overdue tryouts whose scheduled expiry was delayed or missed.
 */
crons.interval(
  "sweep expired tryouts",
  { minutes: TRYOUT_EXPIRY_SWEEP_INTERVAL_MINUTES },
  internal.tryouts.mutations.internal.expiry.sweepExpiredTryoutAttempts,
  {}
);

/**
 * Repairs overdue event access campaign and grant statuses.
 */
crons.interval(
  "sweep tryout access statuses",
  { minutes: TRYOUT_ACCESS_STATUS_SWEEP_INTERVAL_MINUTES },
  internal.tryoutAccess.mutations.internal.status.sweepStates,
  {}
);

export default crons;

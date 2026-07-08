import { internal } from "@repo/backend/convex/_generated/api";
import { cronJobs } from "convex/server";

const crons = cronJobs();
const CONTENT_ANALYTICS_BACKSTOP_INTERVAL_MINUTES = 10;
const CREDIT_RESET_PERIOD_RECONCILE_INTERVAL_MINUTES = 10;
const NINA_CAPABILITY_TRACE_RETENTION_INTERVAL_HOURS = 24;
const TRYOUT_EXPIRY_SWEEP_INTERVAL_MINUTES = 5;

/**
 * Materializes the current daily reset boundary for free-plan credits.
 */
crons.cron(
  "sync free credit reset period",
  "0 0 * * *",
  internal.credits.mutations.syncCreditResetPeriod,
  { plan: "free" }
);

/**
 * Materializes the current monthly reset boundary for pro-plan credits.
 */
crons.cron(
  "sync pro credit reset period",
  "0 0 1 * *",
  internal.credits.mutations.syncCreditResetPeriod,
  { plan: "pro" }
);

/**
 * Reconciles materialized credit reset periods if an exact-boundary cron was missed.
 */
crons.interval(
  "reconcile credit reset periods",
  { minutes: CREDIT_RESET_PERIOD_RECONCILE_INTERVAL_MINUTES },
  internal.credits.mutations.syncAllCreditResetPeriods,
  {}
);

/**
 * Backstops content analytics scheduling in case a per-view trigger is missed.
 */
crons.interval(
  "schedule content analytics partitions",
  { minutes: CONTENT_ANALYTICS_BACKSTOP_INTERVAL_MINUTES },
  internal.contents.mutations.analytics.scheduleContentAnalyticsPartitions,
  {}
);

/**
 * Rebuilds finite popularity windows from audited daily signals.
 */
crons.cron(
  "refresh learning popularity windows",
  "15 0 * * *",
  internal.contents.mutations.popularity.scheduleLearningPopularityRefreshes,
  {}
);

/**
 * Deletes expired derived Nina capability trace summaries in bounded pages.
 */
crons.interval(
  "sweep Nina capability traces",
  { hours: NINA_CAPABILITY_TRACE_RETENTION_INTERVAL_HOURS },
  internal.chats.traces.mutations.sweepExpired,
  {}
);

/**
 * Reconciles try-out expiry if a scheduled attempt or section job is missed.
 */
crons.interval(
  "sweep try-out expiry",
  { minutes: TRYOUT_EXPIRY_SWEEP_INTERVAL_MINUTES },
  internal.tryouts.mutations.expiry.sweep,
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

export default crons;

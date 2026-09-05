import { internal } from "@repo/backend/convex/_generated/api";
import {
  ACCOUNT_DELETION_ATTEMPT_SWEEP_INTERVAL_HOURS,
  ACCOUNT_DELETION_RECOVERY_SWEEP_INTERVAL_MINUTES,
} from "@repo/backend/convex/auth/deletion/constants";
import { cronJobs } from "convex/server";

const crons = cronJobs();
const CONTENT_ANALYTICS_BACKSTOP_INTERVAL_HOURS = 1;
const CONTENT_RELEASE_COMPACTION_INTERVAL_MINUTES = 10;
const CREDIT_RESET_PERIOD_RECONCILE_INTERVAL_MINUTES = 10;
const EMAIL_RETENTION_SWEEP_INTERVAL_HOURS = 1;
const NINA_CAPABILITY_TRACE_RETENTION_INTERVAL_HOURS = 24;
const TRYOUT_EXPIRY_SWEEP_INTERVAL_MINUTES = 5;

/**
 * Reconciles prepared deletions even when an at-most-once recovery action
 * never starts.
 */
crons.interval(
  "sweep account deletion recovery",
  { minutes: ACCOUNT_DELETION_RECOVERY_SWEEP_INTERVAL_MINUTES },
  internal.auth.deletion.recovery.sweepAccountDeletionRecovery,
  {}
);

/** Removes expired opaque attempt artifacts after the retry window closes. */
crons.interval(
  "sweep account deletion retention",
  { hours: ACCOUNT_DELETION_ATTEMPT_SWEEP_INTERVAL_HOURS },
  internal.auth.deletion.sweepAccountDeletionRetention,
  {}
);

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

/** Recovers queued views whose immediate partition schedule was missed. */
crons.interval(
  "schedule content analytics partitions",
  { hours: CONTENT_ANALYTICS_BACKSTOP_INTERVAL_HOURS },
  internal.contents.mutations.analytics.scheduleContentAnalyticsPartitions,
  {}
);

/** Compacts unreachable content release history in persisted bounded pages. */
crons.interval(
  "compact content release history",
  { minutes: CONTENT_RELEASE_COMPACTION_INTERVAL_MINUTES },
  internal.contentRelease.compact.run,
  {}
);

/**
 * Applies component retention and releases terminal app-owned email handles.
 */
crons.interval(
  "sweep retained email delivery data",
  { hours: EMAIL_RETENTION_SWEEP_INTERVAL_HOURS },
  internal.emails.retention.cleanupRetainedEmailData,
  {}
);

/** Expires the one outgoing day from each finite popularity window. */
crons.cron(
  "expire learning popularity windows",
  "15 0 * * 1-6",
  internal.contents.mutations.popularity.scheduleLearningPopularityExpiries,
  {}
);

/** Rebuilds every finite window weekly from audited daily signals. */
crons.cron(
  "repair learning popularity windows",
  "15 0 * * 0",
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

export default crons;

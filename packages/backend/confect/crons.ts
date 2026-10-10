import { CronJob, CronJobs } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import {
  ACCOUNT_DELETION_ATTEMPT_SWEEP_INTERVAL_HOURS,
  ACCOUNT_DELETION_RECOVERY_SWEEP_INTERVAL_MINUTES,
} from "@repo/backend/confect/auth/deletion/constants";
import { Cron, Duration } from "effect";

const { internal } = refs;
const CONTENT_ANALYTICS_BACKSTOP_INTERVAL_HOURS = 1;
const CONTENT_RELEASE_COMPACTION_INTERVAL_MINUTES = 10;
const CREDIT_RESET_PERIOD_RECONCILE_INTERVAL_MINUTES = 10;
const EMAIL_RETENTION_SWEEP_INTERVAL_HOURS = 1;
const POPULARITY_RETENTION_INTERVAL_HOURS = 1;
const TRYOUT_EXPIRY_SWEEP_INTERVAL_MINUTES = 5;

/**
 * Reconciles prepared deletions even when an at-most-once recovery action
 * never starts.
 */
export default CronJobs.make()
  .add(
    CronJob.make(
      "reclaim unused Nina files",
      Duration.hours(24),
      internal.storage.sweep,
      {}
    )
  )
  .add(
    /** Deletes the situations Nina remembered whose end date has passed. */ CronJob.make(
      "expire ended Nina memories",
      Duration.hours(24),
      internal.nina.memory.expire,
      {}
    )
  )
  .add(
    CronJob.make(
      "sweep account deletion recovery",
      Duration.minutes(ACCOUNT_DELETION_RECOVERY_SWEEP_INTERVAL_MINUTES),
      internal.auth.deletion.recovery.sweepAccountDeletionRecovery,
      {}
    )
  )
  .add(
    /** Removes expired opaque attempt artifacts after the retry window closes. */ CronJob.make(
      "sweep account deletion retention",
      Duration.hours(ACCOUNT_DELETION_ATTEMPT_SWEEP_INTERVAL_HOURS),
      internal.auth.deletion.sweepAccountDeletionRetention,
      {}
    )
  )
  .add(
    /**
     * Materializes the current daily reset boundary for free-plan credits.
     */
    CronJob.make(
      "sync free credit reset period",
      Cron.make({
        minutes: [0],
        hours: [0],
        days: [],
        months: [],
        weekdays: [],
      }),
      internal.credits.mutations.syncCreditResetPeriod,
      {
        plan: "free",
      }
    )
  )
  .add(
    /**
     * Materializes the current monthly reset boundary for pro-plan credits.
     */
    CronJob.make(
      "sync pro credit reset period",
      Cron.make({
        minutes: [0],
        hours: [0],
        days: [1],
        months: [],
        weekdays: [],
      }),
      internal.credits.mutations.syncCreditResetPeriod,
      {
        plan: "pro",
      }
    )
  )
  .add(
    /**
     * Reconciles materialized credit reset periods if an exact-boundary cron was missed.
     */
    CronJob.make(
      "reconcile credit reset periods",
      Duration.minutes(CREDIT_RESET_PERIOD_RECONCILE_INTERVAL_MINUTES),
      internal.credits.mutations.syncAllCreditResetPeriods,
      {}
    )
  )
  .add(
    /** Recovers queued views whose immediate partition schedule was missed. */ CronJob.make(
      "schedule content analytics partitions",
      Duration.hours(CONTENT_ANALYTICS_BACKSTOP_INTERVAL_HOURS),
      internal.contents.mutations.analytics.scheduleContentAnalyticsPartitions,
      {}
    )
  )
  .add(
    /** Compacts unreachable content release history in persisted bounded pages. */ CronJob.make(
      "compact content release history",
      Duration.minutes(CONTENT_RELEASE_COMPACTION_INTERVAL_MINUTES),
      internal.contentRelease.compact.run,
      {}
    )
  )
  .add(
    /**
     * Applies component retention and releases terminal app-owned email handles.
     */
    CronJob.make(
      "sweep retained email delivery data",
      Duration.hours(EMAIL_RETENTION_SWEEP_INTERVAL_HOURS),
      internal.emails.retention.cleanupRetainedEmailData,
      {}
    )
  )
  .add(
    /** Expires the one outgoing day from each finite popularity window. */ CronJob.make(
      "expire learning popularity windows",
      Cron.make({
        minutes: [15],
        hours: [0],
        days: [],
        months: [],
        weekdays: [1, 2, 3, 4, 5, 6],
      }),
      internal.contents.mutations.popularity.scheduleLearningPopularityExpiries,
      {}
    )
  )
  .add(
    /** Rebuilds every finite window weekly from audited daily signals. */ CronJob.make(
      "repair learning popularity windows",
      Cron.make({
        minutes: [15],
        hours: [0],
        days: [],
        months: [],
        weekdays: [0],
      }),
      internal.contents.mutations.popularity
        .scheduleLearningPopularityRefreshes,
      {}
    )
  )
  .add(
    /** Recovers bounded retention without keeping a separate checkpoint table. */ CronJob.make(
      "prune expired popularity inputs",
      Duration.hours(POPULARITY_RETENTION_INTERVAL_HOURS),
      internal.contents.mutations.popularity.pruneLearningPopularity,
      {}
    )
  )
  .add(
    /**
     * Reconciles try-out expiry if a scheduled attempt or section job is missed.
     */
    CronJob.make(
      "sweep try-out expiry",
      Duration.minutes(TRYOUT_EXPIRY_SWEEP_INTERVAL_MINUTES),
      internal.tryouts.mutations.expiry.sweep,
      {}
    )
  );

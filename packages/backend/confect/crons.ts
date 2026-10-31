import { CronJob, CronJobs } from "@confect/server";
import authInternal from "@repo/backend/confect/_generated/refs/auth.server";
import billingInternal from "@repo/backend/confect/_generated/refs/billing.server";
import classroomInternal from "@repo/backend/confect/_generated/refs/classroom.server";
import connectorsInternal from "@repo/backend/confect/_generated/refs/connectors.server";
import contentReleaseInternal from "@repo/backend/confect/_generated/refs/contentRelease.server";
import contentsInternal from "@repo/backend/confect/_generated/refs/contents.server";
import creditsInternal from "@repo/backend/confect/_generated/refs/credits.server";
import editorInternal from "@repo/backend/confect/_generated/refs/editor.server";
import emailsInternal from "@repo/backend/confect/_generated/refs/emails.server";
import examsInternal from "@repo/backend/confect/_generated/refs/exams.server";
import guardiansInternal from "@repo/backend/confect/_generated/refs/guardians.server";
import integrationsInternal from "@repo/backend/confect/_generated/refs/integrations.server";
import ninaInternal from "@repo/backend/confect/_generated/refs/nina.server";
import notificationsInternal from "@repo/backend/confect/_generated/refs/notifications.server";
import operatorsInternal from "@repo/backend/confect/_generated/refs/operators.server";
import storageInternal from "@repo/backend/confect/_generated/refs/storage.server";
import tenancyInternal from "@repo/backend/confect/_generated/refs/tenancy.server";
import tryoutsInternal from "@repo/backend/confect/_generated/refs/tryouts.server";
import {
  ACCOUNT_DELETION_ATTEMPT_SWEEP_INTERVAL_HOURS,
  ACCOUNT_DELETION_RECOVERY_SWEEP_INTERVAL_MINUTES,
} from "@repo/backend/confect/auth/deletion/constants";
import { BILLING_EVENT_SWEEP_INTERVAL_MINUTES } from "@repo/backend/confect/billing/sweep";
import { PRUNE_INTERVAL } from "@repo/backend/confect/editor/prune";
import { SITTING_SWEEP_INTERVAL } from "@repo/backend/confect/exams/sittings/sweep";
import { SWEEP_INTERVAL } from "@repo/backend/confect/nina/deadline";
import { Cron, Duration } from "effect";

const BILLING_EVENT_CLEANUP_INTERVAL_HOURS = 24;
const POLAR_RECONCILE_INTERVAL_HOURS = 24;
const CONNECTOR_SYNC_INTERVAL_MINUTES = 10;
const CONTENT_ANALYTICS_BACKSTOP_INTERVAL_HOURS = 1;
const CONTENT_RELEASE_COMPACTION_INTERVAL_MINUTES = 10;
const CREDIT_RESET_PERIOD_RECONCILE_INTERVAL_MINUTES = 10;
const EMAIL_RETENTION_SWEEP_INTERVAL_HOURS = 1;
const GUARDIAN_CODE_SWEEP_INTERVAL_HOURS = 1;
const INBOX_SWEEP_INTERVAL_MINUTES = 1;
const INTEGRATION_TOKEN_SWEEP_INTERVAL_HOURS = 1;
const INVITE_EXPIRY_SWEEP_INTERVAL_HOURS = 1;
const TRYOUT_EXPIRY_SWEEP_INTERVAL_MINUTES = 5;
const VISIT_EXPIRY_SWEEP_INTERVAL_HOURS = 1;

/**
 * Reconciles prepared deletions even when an at-most-once recovery action
 * never starts.
 */
export default CronJobs.make()
  .add(
    CronJob.make(
      "sync due connectors",
      Duration.minutes(CONNECTOR_SYNC_INTERVAL_MINUTES),
      connectorsInternal.sync.sweep,
      {}
    )
  )
  .add(
    CronJob.make(
      "sweep billing webhooks",
      Duration.minutes(BILLING_EVENT_SWEEP_INTERVAL_MINUTES),
      billingInternal.events.sweep,
      {}
    )
  )
  .add(
    CronJob.make(
      "reconcile Polar subscriptions",
      Duration.hours(POLAR_RECONCILE_INTERVAL_HOURS),
      billingInternal.reconcile.run,
      { page: 1 }
    )
  )
  .add(
    CronJob.make(
      "delete expired billing webhooks",
      Duration.hours(BILLING_EVENT_CLEANUP_INTERVAL_HOURS),
      billingInternal.events.cleanup,
      {}
    )
  )
  .add(
    CronJob.make(
      "delete unsent chat files",
      Duration.hours(24),
      classroomInternal.forum.files.sweep,
      {}
    )
  )
  .add(
    CronJob.make(
      "reclaim unused Nina files",
      Duration.hours(24),
      storageInternal.sweep,
      {}
    )
  )
  .add(
    /** Deletes the situations Nina remembered whose end date has passed. */ CronJob.make(
      "expire ended Nina memories",
      Duration.hours(24),
      ninaInternal.memory.expire,
      {}
    )
  )
  .add(
    /** Settles Nina turns that stayed open past their deadline, so no chat stays busy. */ CronJob.make(
      "sweep stuck Nina turns",
      SWEEP_INTERVAL,
      ninaInternal.lifecycle.sweep,
      {}
    )
  )
  .add(
    CronJob.make(
      "sweep account deletion recovery",
      Duration.minutes(ACCOUNT_DELETION_RECOVERY_SWEEP_INTERVAL_MINUTES),
      authInternal.deletion.recovery.sweepAccountDeletionRecovery,
      {}
    )
  )
  .add(
    /** Removes expired opaque attempt artifacts after the retry window closes. */ CronJob.make(
      "sweep account deletion retention",
      Duration.hours(ACCOUNT_DELETION_ATTEMPT_SWEEP_INTERVAL_HOURS),
      authInternal.deletion.sweepAccountDeletionRetention,
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
      creditsInternal.mutations.syncCreditResetPeriod,
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
      creditsInternal.mutations.syncCreditResetPeriod,
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
      creditsInternal.mutations.syncAllCreditResetPeriods,
      {}
    )
  )
  .add(
    /** Recovers queued views whose immediate partition schedule was missed. */ CronJob.make(
      "schedule content analytics partitions",
      Duration.hours(CONTENT_ANALYTICS_BACKSTOP_INTERVAL_HOURS),
      contentsInternal.mutations.analytics.scheduleContentAnalyticsPartitions,
      {}
    )
  )
  .add(
    /** Compacts unreachable content release history in persisted bounded pages. */ CronJob.make(
      "compact content release history",
      Duration.minutes(CONTENT_RELEASE_COMPACTION_INTERVAL_MINUTES),
      contentReleaseInternal.compact.run,
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
      emailsInternal.retention.cleanupRetainedEmailData,
      {}
    )
  )
  .add(
    /** Expires the one outgoing day from the seven-day popularity window. */ CronJob.make(
      "expire learning popularity windows",
      Cron.make({
        minutes: [15],
        hours: [0],
        days: [],
        months: [],
        weekdays: [1, 2, 3, 4, 5, 6],
      }),
      contentsInternal.mutations.popularity.scheduleLearningPopularityExpiries,
      {}
    )
  )
  .add(
    /** Recomputes each seven-day popularity counter weekly from its daily signals. */ CronJob.make(
      "repair learning popularity windows",
      Cron.make({
        minutes: [15],
        hours: [0],
        days: [],
        months: [],
        weekdays: [0],
      }),
      contentsInternal.mutations.popularity.scheduleLearningPopularityRefreshes,
      {}
    )
  )
  .add(
    /**
     * Prunes expired popularity inputs in bounded pages, at minute 45 of every
     * hour. The pass reads the maintenance row, when an expired daily signal
     * exists, and never writes it. The daily expiry and the weekly repair start
     * at minute 15 of hour 0 and rewrite that row on every page of their chain,
     * and Convex runs the pass again when its read overlaps such a write.
     * Starting 30 minutes from them keeps the pass out of any chain that ends
     * within 30 minutes.
     */
    CronJob.make(
      "prune expired popularity inputs",
      Cron.make({
        minutes: [45],
        hours: [],
        days: [],
        months: [],
        weekdays: [],
      }),
      contentsInternal.mutations.popularity.pruneLearningPopularity,
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
      tryoutsInternal.mutations.expiry.sweep,
      {}
    )
  )
  .add(
    /**
     * Expires the pending invites whose term has passed, if the scheduled expiry
     * of an invite never ran.
     */
    CronJob.make(
      "sweep invite expiry",
      Duration.hours(INVITE_EXPIRY_SWEEP_INTERVAL_HOURS),
      tenancyInternal.expiry.sweep,
      {}
    )
  )
  .add(
    /**
     * Sends again the opening, closing, or submission of a sitting that did not
     * happen, since Convex does not retry a scheduled mutation that failed (ADR 0013).
     */
    CronJob.make(
      "sweep late sitting steps",
      SITTING_SWEEP_INTERVAL,
      examsInternal.sittings.timers.sweep,
      {}
    )
  )
  .add(
    /**
     * Ends the approved operator visits whose term has passed, if the scheduled
     * end of a visit never ran.
     */
    CronJob.make(
      "sweep visit expiry",
      Duration.hours(VISIT_EXPIRY_SWEEP_INTERVAL_HOURS),
      operatorsInternal.expiry.sweep,
      {}
    )
  )
  .add(
    /**
     * Deletes the editor steps that a snapshot covers, once they are older than the
     * keep delay, and the log keeps the rest.
     */
    CronJob.make(
      "prune covered editor steps",
      PRUNE_INTERVAL,
      editorInternal.prune.sweep,
      { cursor: null }
    )
  )
  .add(
    /**
     * Starts a run for each inbox cursor that a change left pending, if the run
     * that the change scheduled never happened.
     */
    CronJob.make(
      "sweep inbox runs",
      Duration.minutes(INBOX_SWEEP_INTERVAL_MINUTES),
      notificationsInternal.consume.sweep,
      {}
    )
  )
  .add(
    /** Deletes guardian sign-in codes that expired unused (ADR 0034). */
    CronJob.make(
      "delete expired guardian codes",
      Duration.hours(GUARDIAN_CODE_SWEEP_INTERVAL_HOURS),
      guardiansInternal.codes.sweep,
      {}
    )
  )
  .add(
    /** Deletes the access tokens of integration clients that expired (ADR 0029). */
    CronJob.make(
      "delete expired integration tokens",
      Duration.hours(INTEGRATION_TOKEN_SWEEP_INTERVAL_HOURS),
      integrationsInternal.tokens.sweep,
      {}
    )
  )
  .add(
    /** Deletes the device authorizations of the device grant that expired (ADR 0029). */
    CronJob.make(
      "delete expired device authorizations",
      Duration.hours(INTEGRATION_TOKEN_SWEEP_INTERVAL_HOURS),
      integrationsInternal.devices.sweep,
      {}
    )
  );

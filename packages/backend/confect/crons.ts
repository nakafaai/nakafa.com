import { CronJob, CronJobs } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import { IRT_AUTOMATION_CRON_INTERVAL_MINUTES } from "@repo/backend/confect/modules/tryout/irt.policy";
import { Cron, Duration } from "effect";

export default CronJobs.make()
  .add(
    CronJob.make(
      "sync free credit reset period",
      Cron.unsafeParse("0 0 * * *"),
      refs.internal.credits.mutations.syncCreditResetPeriod,
      { plan: "free" }
    )
  )
  .add(
    CronJob.make(
      "sync pro credit reset period",
      Cron.unsafeParse("0 0 1 * *"),
      refs.internal.credits.mutations.syncCreditResetPeriod,
      { plan: "pro" }
    )
  )
  .add(
    CronJob.make(
      "repair credit reset periods",
      Duration.minutes(1),
      refs.internal.credits.mutations.syncAllCreditResetPeriods,
      {}
    )
  )
  .add(
    CronJob.make(
      "schedule content analytics partitions",
      Duration.minutes(10),
      refs.internal.contents.mutations.analytics
        .scheduleContentAnalyticsPartitions,
      {}
    )
  )
  .add(
    CronJob.make(
      "populate audio generation queue",
      Duration.minutes(30),
      refs.internal.contents.actions.queue.populateAudioQueue,
      {}
    )
  )
  .add(
    CronJob.make(
      "process audio generation queue",
      Duration.minutes(45),
      refs.internal.audioStudies.mutations.queue.startWorkflowsForPendingItems,
      {}
    )
  )
  .add(
    CronJob.make(
      "cleanup audio generation",
      Cron.unsafeParse("0 2 * * *"),
      refs.internal.audioStudies.mutations.queue.cleanup,
      {}
    )
  )
  .add(
    CronJob.make(
      "reset stuck queue items",
      Duration.minutes(60),
      refs.internal.audioStudies.mutations.queue.resetStuckQueueItems,
      {}
    )
  )
  .add(
    CronJob.make(
      "drain irt calibration queue",
      Duration.minutes(IRT_AUTOMATION_CRON_INTERVAL_MINUTES),
      refs.internal.irt.mutations.internalFunctions.queue.drainCalibrationQueue,
      {}
    )
  )
  .add(
    CronJob.make(
      "drain irt scale publication queue",
      Duration.minutes(15),
      refs.internal.irt.mutations.internalFunctions.scales
        .drainScalePublicationQueue,
      {}
    )
  )
  .add(
    CronJob.make(
      "drain irt scale quality refresh queue",
      Duration.minutes(15),
      refs.internal.irt.mutations.internalFunctions.scales
        .drainScaleQualityRefreshQueue,
      {}
    )
  )
  .add(
    CronJob.make(
      "rebuild irt scale quality checks",
      Cron.unsafeParse("0 */6 * * *"),
      refs.internal.irt.mutations.internalFunctions.scales
        .rebuildScaleQualityChecksPage,
      {}
    )
  )
  .add(
    CronJob.make(
      "sweep expired tryouts",
      Duration.minutes(5),
      refs.internal.tryouts.mutations.internalFunctions.expiry
        .sweepExpiredTryoutAttempts,
      {}
    )
  )
  .add(
    CronJob.make(
      "sweep tryout access statuses",
      Duration.minutes(5),
      refs.internal.tryoutAccess.mutations.internalFunctions.status.sweepStates,
      {}
    )
  );

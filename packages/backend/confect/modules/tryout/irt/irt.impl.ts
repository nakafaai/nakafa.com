import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { calibrateSetTwoPLWorkflow } from "@repo/backend/confect/modules/tryout/irt/workflows";
import {
  rebuildCalibrationCacheStatsForSet,
  trimCalibrationCacheForSet,
} from "@repo/backend/confect/modules/tryout/irtCache.service";
import { calibrateSetTwoPL } from "@repo/backend/confect/modules/tryout/irtCalibration.actions";
import {
  getCalibrationCacheIntegrity,
  getCalibrationQuestionsForSet,
  getCalibrationQueueAttemptIntegrity,
  getCalibrationQueueEntryIntegrity,
  getCalibrationResponsesPageForSet,
  getScaleQualityIntegrity,
} from "@repo/backend/confect/modules/tryout/irtQueries.service";
import {
  cleanupCalibrationQueueEntries,
  cleanupScalePublicationQueueEntries,
  drainCalibrationQueue,
  enqueueScalePublication,
} from "@repo/backend/confect/modules/tryout/irtQueue.service";
import { syncCalibrationResponsesForAttempt } from "@repo/backend/confect/modules/tryout/irtResponses.service";
import {
  completeCalibrationRun,
  failCalibrationRun,
} from "@repo/backend/confect/modules/tryout/irtRuns.service";
import {
  drainScalePublicationQueue,
  drainScaleQualityRefreshQueue,
  rebuildScaleQualityChecksPage,
  refreshScaleQualityCheck,
} from "@repo/backend/confect/modules/tryout/irtScales.service";
import { Effect, Layer } from "effect";

const irt_workflows_calibrateSetTwoPLImpl = FunctionImpl.make(
  api,
  "irt.workflows",
  "calibrateSetTwoPL",
  calibrateSetTwoPLWorkflow
);

const irt_actions_internal_calibration_calibrateSetTwoPLImpl =
  FunctionImpl.make(
    api,
    "irt.actions.internalFunctions.calibration",
    "calibrateSetTwoPL",
    (args) =>
      calibrateSetTwoPL(args).pipe(
        Effect.catchTag("IrtError", (error) => Effect.die(error)),
        Effect.orDie
      )
  );

const irt_queries_internal_calibration_getCalibrationQuestionsForSetImpl =
  FunctionImpl.make(
    api,
    "irt.queries.internalFunctions.calibration",
    "getCalibrationQuestionsForSet",
    (args) =>
      getCalibrationQuestionsForSet(args).pipe(
        Effect.catchTag("IrtError", (error) => Effect.die(error)),
        Effect.orDie
      )
  );

const irt_queries_internal_calibration_getCalibrationResponsesPageForSetImpl =
  FunctionImpl.make(
    api,
    "irt.queries.internalFunctions.calibration",
    "getCalibrationResponsesPageForSet",
    (args) =>
      getCalibrationResponsesPageForSet(args).pipe(
        Effect.catchTag("IrtError", (error) => Effect.die(error)),
        Effect.orDie
      )
  );

const irt_mutations_internal_cache_rebuildCalibrationCacheStatsForSetImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.cache",
    "rebuildCalibrationCacheStatsForSet",
    (args) => rebuildCalibrationCacheStatsForSet(args).pipe(Effect.orDie)
  );

const irt_mutations_internal_cache_trimCalibrationCacheForSetImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.cache",
    "trimCalibrationCacheForSet",
    (args) => trimCalibrationCacheForSet(args).pipe(Effect.orDie)
  );

const irt_mutations_internal_responses_syncCalibrationResponsesForAttemptImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.responses",
    "syncCalibrationResponsesForAttempt",
    (args) =>
      syncCalibrationResponsesForAttempt(args).pipe(
        Effect.catchTag("IrtError", (error) => Effect.die(error)),
        Effect.orDie
      )
  );

const irt_mutations_internal_queue_cleanupCalibrationQueueEntriesImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.queue",
    "cleanupCalibrationQueueEntries",
    (args) => cleanupCalibrationQueueEntries(args).pipe(Effect.orDie)
  );

const irt_mutations_internal_queue_cleanupScalePublicationQueueEntriesImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.queue",
    "cleanupScalePublicationQueueEntries",
    (args) => cleanupScalePublicationQueueEntries(args).pipe(Effect.orDie)
  );

const irt_mutations_internal_queue_drainCalibrationQueueImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.queue",
    "drainCalibrationQueue",
    (_args) =>
      drainCalibrationQueue().pipe(
        Effect.catchTag("IrtError", (error) => Effect.die(error)),
        Effect.orDie
      )
  );

const irt_mutations_internal_queue_enqueueScalePublicationImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.queue",
    "enqueueScalePublication",
    (args) => enqueueScalePublication(args).pipe(Effect.orDie)
  );

const irt_mutations_internal_runs_completeCalibrationRunImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.runs",
    "completeCalibrationRun",
    (args) =>
      completeCalibrationRun(args).pipe(
        Effect.catchTag("IrtError", (error) => Effect.die(error)),
        Effect.orDie
      )
  );

const irt_mutations_internal_runs_failCalibrationRunImpl = FunctionImpl.make(
  api,
  "irt.mutations.internalFunctions.runs",
  "failCalibrationRun",
  (args) =>
    failCalibrationRun(args).pipe(
      Effect.catchTag("IrtError", (error) => Effect.die(error)),
      Effect.orDie
    )
);

const irt_mutations_internal_scales_drainScalePublicationQueueImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.scales",
    "drainScalePublicationQueue",
    (_args) =>
      drainScalePublicationQueue().pipe(
        Effect.catchTag("IrtError", (error) => Effect.die(error)),
        Effect.orDie
      )
  );

const irt_mutations_internal_scales_drainScaleQualityRefreshQueueImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.scales",
    "drainScaleQualityRefreshQueue",
    (_args) => drainScaleQualityRefreshQueue().pipe(Effect.orDie)
  );

const irt_mutations_internal_scales_rebuildScaleQualityChecksPageImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.scales",
    "rebuildScaleQualityChecksPage",
    (args) => rebuildScaleQualityChecksPage(args).pipe(Effect.orDie)
  );

const irt_mutations_internal_scales_refreshScaleQualityCheckImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.scales",
    "refreshScaleQualityCheck",
    (args) => refreshScaleQualityCheck(args).pipe(Effect.orDie)
  );

const irt_queries_internal_maintenance_getCalibrationCacheIntegrityImpl =
  FunctionImpl.make(
    api,
    "irt.queries.internalFunctions.maintenance",
    "getCalibrationCacheIntegrity",
    (args) => getCalibrationCacheIntegrity(args).pipe(Effect.orDie)
  );

const irt_queries_internal_maintenance_getScaleQualityIntegrityImpl =
  FunctionImpl.make(
    api,
    "irt.queries.internalFunctions.maintenance",
    "getScaleQualityIntegrity",
    (args) => getScaleQualityIntegrity(args).pipe(Effect.orDie)
  );

const irt_queries_internal_maintenance_getCalibrationQueueAttemptIntegrityImpl =
  FunctionImpl.make(
    api,
    "irt.queries.internalFunctions.maintenance",
    "getCalibrationQueueAttemptIntegrity",
    (args) => getCalibrationQueueAttemptIntegrity(args).pipe(Effect.orDie)
  );

const irt_queries_internal_maintenance_getCalibrationQueueEntryIntegrityImpl =
  FunctionImpl.make(
    api,
    "irt.queries.internalFunctions.maintenance",
    "getCalibrationQueueEntryIntegrity",
    (args) => getCalibrationQueueEntryIntegrity(args).pipe(Effect.orDie)
  );

const irtActionsInternalCalibrationImpl = GroupImpl.make(
  api,
  "irt.actions.internalFunctions.calibration"
).pipe(Layer.provide(irt_actions_internal_calibration_calibrateSetTwoPLImpl));

const irtMutationsInternalCacheImpl = GroupImpl.make(
  api,
  "irt.mutations.internalFunctions.cache"
)
  .pipe(
    Layer.provide(
      irt_mutations_internal_cache_rebuildCalibrationCacheStatsForSetImpl
    )
  )
  .pipe(
    Layer.provide(irt_mutations_internal_cache_trimCalibrationCacheForSetImpl)
  );

const irtMutationsInternalQueueImpl = GroupImpl.make(
  api,
  "irt.mutations.internalFunctions.queue"
)
  .pipe(
    Layer.provide(
      irt_mutations_internal_queue_cleanupCalibrationQueueEntriesImpl
    )
  )
  .pipe(
    Layer.provide(
      irt_mutations_internal_queue_cleanupScalePublicationQueueEntriesImpl
    )
  )
  .pipe(Layer.provide(irt_mutations_internal_queue_drainCalibrationQueueImpl))
  .pipe(
    Layer.provide(irt_mutations_internal_queue_enqueueScalePublicationImpl)
  );

const irtMutationsInternalResponsesImpl = GroupImpl.make(
  api,
  "irt.mutations.internalFunctions.responses"
).pipe(
  Layer.provide(
    irt_mutations_internal_responses_syncCalibrationResponsesForAttemptImpl
  )
);

const irtMutationsInternalRunsImpl = GroupImpl.make(
  api,
  "irt.mutations.internalFunctions.runs"
)
  .pipe(Layer.provide(irt_mutations_internal_runs_completeCalibrationRunImpl))
  .pipe(Layer.provide(irt_mutations_internal_runs_failCalibrationRunImpl));

const irtMutationsInternalScalesImpl = GroupImpl.make(
  api,
  "irt.mutations.internalFunctions.scales"
)
  .pipe(
    Layer.provide(irt_mutations_internal_scales_drainScalePublicationQueueImpl)
  )
  .pipe(
    Layer.provide(
      irt_mutations_internal_scales_drainScaleQualityRefreshQueueImpl
    )
  )
  .pipe(
    Layer.provide(
      irt_mutations_internal_scales_rebuildScaleQualityChecksPageImpl
    )
  )
  .pipe(
    Layer.provide(irt_mutations_internal_scales_refreshScaleQualityCheckImpl)
  );

const irtQueriesInternalCalibrationImpl = GroupImpl.make(
  api,
  "irt.queries.internalFunctions.calibration"
)
  .pipe(
    Layer.provide(
      irt_queries_internal_calibration_getCalibrationQuestionsForSetImpl
    )
  )
  .pipe(
    Layer.provide(
      irt_queries_internal_calibration_getCalibrationResponsesPageForSetImpl
    )
  );

const irtQueriesInternalMaintenanceImpl = GroupImpl.make(
  api,
  "irt.queries.internalFunctions.maintenance"
)
  .pipe(
    Layer.provide(
      irt_queries_internal_maintenance_getCalibrationCacheIntegrityImpl
    )
  )
  .pipe(
    Layer.provide(irt_queries_internal_maintenance_getScaleQualityIntegrityImpl)
  )
  .pipe(
    Layer.provide(
      irt_queries_internal_maintenance_getCalibrationQueueAttemptIntegrityImpl
    )
  )
  .pipe(
    Layer.provide(
      irt_queries_internal_maintenance_getCalibrationQueueEntryIntegrityImpl
    )
  );

const irtActionsInternalImpl = GroupImpl.make(
  api,
  "irt.actions.internalFunctions"
).pipe(Layer.provide(irtActionsInternalCalibrationImpl));

const irtMutationsInternalImpl = GroupImpl.make(
  api,
  "irt.mutations.internalFunctions"
)
  .pipe(Layer.provide(irtMutationsInternalCacheImpl))
  .pipe(Layer.provide(irtMutationsInternalQueueImpl))
  .pipe(Layer.provide(irtMutationsInternalResponsesImpl))
  .pipe(Layer.provide(irtMutationsInternalRunsImpl))
  .pipe(Layer.provide(irtMutationsInternalScalesImpl));

const irtQueriesInternalImpl = GroupImpl.make(
  api,
  "irt.queries.internalFunctions"
)
  .pipe(Layer.provide(irtQueriesInternalCalibrationImpl))
  .pipe(Layer.provide(irtQueriesInternalMaintenanceImpl));

const irtActionsImpl = GroupImpl.make(api, "irt.actions").pipe(
  Layer.provide(irtActionsInternalImpl)
);

const irtMutationsImpl = GroupImpl.make(api, "irt.mutations").pipe(
  Layer.provide(irtMutationsInternalImpl)
);

const irtQueriesImpl = GroupImpl.make(api, "irt.queries").pipe(
  Layer.provide(irtQueriesInternalImpl)
);

const irtWorkflowsImpl = GroupImpl.make(api, "irt.workflows").pipe(
  Layer.provide(irt_workflows_calibrateSetTwoPLImpl)
);

const irtImpl = GroupImpl.make(api, "irt")
  .pipe(Layer.provide(irtActionsImpl))
  .pipe(Layer.provide(irtMutationsImpl))
  .pipe(Layer.provide(irtQueriesImpl))
  .pipe(Layer.provide(irtWorkflowsImpl));

export const irtLayer = Layer.mergeAll(irtImpl);

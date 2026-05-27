import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { calibrateSetTwoPL } from "@repo/backend/confect/modules/tryout/irt/workflows";
import * as tryout_irt_cache from "@repo/backend/confect/modules/tryout/irtCache.service";
import * as tryout_irt_calibration from "@repo/backend/confect/modules/tryout/irtCalibration.actions";
import * as tryout_irt_queries from "@repo/backend/confect/modules/tryout/irtQueries.service";
import * as tryout_irt_queue from "@repo/backend/confect/modules/tryout/irtQueue.service";
import * as tryout_irt_responses from "@repo/backend/confect/modules/tryout/irtResponses.service";
import * as tryout_irt_runs from "@repo/backend/confect/modules/tryout/irtRuns.service";
import * as tryout_irt_scales from "@repo/backend/confect/modules/tryout/irtScales.service";
import { Effect, Layer } from "effect";

const irt_workflows_calibrateSetTwoPLImpl = FunctionImpl.make(
  api,
  "irt.workflows",
  "calibrateSetTwoPL",
  calibrateSetTwoPL
);

const irt_actions_internal_calibration_calibrateSetTwoPLImpl =
  FunctionImpl.make(
    api,
    "irt.actions.internalFunctions.calibration",
    "calibrateSetTwoPL",
    (args) =>
      tryout_irt_calibration
        .calibrateSetTwoPL(args)
        .pipe(Effect.catchTag("IrtError", (error) => Effect.die(error)))
  );

const irt_queries_internal_calibration_getCalibrationQuestionsForSetImpl =
  FunctionImpl.make(
    api,
    "irt.queries.internalFunctions.calibration",
    "getCalibrationQuestionsForSet",
    (args) =>
      tryout_irt_queries
        .getCalibrationQuestionsForSet(args)
        .pipe(Effect.catchTag("IrtError", (error) => Effect.die(error)))
  );

const irt_queries_internal_calibration_getCalibrationResponsesPageForSetImpl =
  FunctionImpl.make(
    api,
    "irt.queries.internalFunctions.calibration",
    "getCalibrationResponsesPageForSet",
    (args) =>
      tryout_irt_queries
        .getCalibrationResponsesPageForSet(args)
        .pipe(Effect.catchTag("IrtError", (error) => Effect.die(error)))
  );

const irt_mutations_internal_cache_rebuildCalibrationCacheStatsForSetImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.cache",
    "rebuildCalibrationCacheStatsForSet",
    (args) => tryout_irt_cache.rebuildCalibrationCacheStatsForSet(args)
  );

const irt_mutations_internal_cache_trimCalibrationCacheForSetImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.cache",
    "trimCalibrationCacheForSet",
    (args) => tryout_irt_cache.trimCalibrationCacheForSet(args)
  );

const irt_mutations_internal_responses_syncCalibrationResponsesForAttemptImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.responses",
    "syncCalibrationResponsesForAttempt",
    (args) =>
      tryout_irt_responses
        .syncCalibrationResponsesForAttempt(args)
        .pipe(Effect.catchTag("IrtError", (error) => Effect.die(error)))
  );

const irt_mutations_internal_queue_cleanupCalibrationQueueEntriesImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.queue",
    "cleanupCalibrationQueueEntries",
    (args) => tryout_irt_queue.cleanupCalibrationQueueEntries(args)
  );

const irt_mutations_internal_queue_cleanupScalePublicationQueueEntriesImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.queue",
    "cleanupScalePublicationQueueEntries",
    (args) => tryout_irt_queue.cleanupScalePublicationQueueEntries(args)
  );

const irt_mutations_internal_queue_drainCalibrationQueueImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.queue",
    "drainCalibrationQueue",
    (_args) =>
      tryout_irt_queue
        .drainCalibrationQueue()
        .pipe(Effect.catchTag("IrtError", (error) => Effect.die(error)))
  );

const irt_mutations_internal_queue_enqueueScalePublicationImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.queue",
    "enqueueScalePublication",
    (args) => tryout_irt_queue.enqueueScalePublication(args)
  );

const irt_mutations_internal_runs_completeCalibrationRunImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.runs",
    "completeCalibrationRun",
    (args) =>
      tryout_irt_runs
        .completeCalibrationRun(args)
        .pipe(Effect.catchTag("IrtError", (error) => Effect.die(error)))
  );

const irt_mutations_internal_runs_failCalibrationRunImpl = FunctionImpl.make(
  api,
  "irt.mutations.internalFunctions.runs",
  "failCalibrationRun",
  (args) =>
    tryout_irt_runs
      .failCalibrationRun(args)
      .pipe(Effect.catchTag("IrtError", (error) => Effect.die(error)))
);

const irt_mutations_internal_scales_drainScalePublicationQueueImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.scales",
    "drainScalePublicationQueue",
    (_args) =>
      tryout_irt_scales
        .drainScalePublicationQueue()
        .pipe(Effect.catchTag("IrtError", (error) => Effect.die(error)))
  );

const irt_mutations_internal_scales_drainScaleQualityRefreshQueueImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.scales",
    "drainScaleQualityRefreshQueue",
    (_args) => tryout_irt_scales.drainScaleQualityRefreshQueue()
  );

const irt_mutations_internal_scales_rebuildScaleQualityChecksPageImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.scales",
    "rebuildScaleQualityChecksPage",
    (args) => tryout_irt_scales.rebuildScaleQualityChecksPage(args)
  );

const irt_mutations_internal_scales_refreshScaleQualityCheckImpl =
  FunctionImpl.make(
    api,
    "irt.mutations.internalFunctions.scales",
    "refreshScaleQualityCheck",
    (args) => tryout_irt_scales.refreshScaleQualityCheck(args)
  );

const irt_queries_internal_maintenance_getCalibrationCacheIntegrityImpl =
  FunctionImpl.make(
    api,
    "irt.queries.internalFunctions.maintenance",
    "getCalibrationCacheIntegrity",
    (args) => tryout_irt_queries.getCalibrationCacheIntegrity(args)
  );

const irt_queries_internal_maintenance_getScaleQualityIntegrityImpl =
  FunctionImpl.make(
    api,
    "irt.queries.internalFunctions.maintenance",
    "getScaleQualityIntegrity",
    (args) => tryout_irt_queries.getScaleQualityIntegrity(args)
  );

const irt_queries_internal_maintenance_getCalibrationQueueAttemptIntegrityImpl =
  FunctionImpl.make(
    api,
    "irt.queries.internalFunctions.maintenance",
    "getCalibrationQueueAttemptIntegrity",
    (args) => tryout_irt_queries.getCalibrationQueueAttemptIntegrity(args)
  );

const irt_queries_internal_maintenance_getCalibrationQueueEntryIntegrityImpl =
  FunctionImpl.make(
    api,
    "irt.queries.internalFunctions.maintenance",
    "getCalibrationQueueEntryIntegrity",
    (args) => tryout_irt_queries.getCalibrationQueueEntryIntegrity(args)
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

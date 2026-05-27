import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import type { CalibrateSetTwoPLWorkflow } from "@repo/backend/confect/modules/tryout/irt.workflow-types";
import { Schema } from "effect";

const irtWorkflowsGroup = GroupSpec.make("workflows").addFunction(
  FunctionSpec.convexInternalMutation<CalibrateSetTwoPLWorkflow>()(
    "calibrateSetTwoPL"
  )
);

export { irtWorkflowsGroup };

const irtActionsInternalCalibrationGroup = GroupSpec.make(
  "calibration"
).addFunction(
  FunctionSpec.internalAction({
    name: "calibrateSetTwoPL",
    args: Schema.Struct({ setId: GenericId.GenericId("exerciseSets") }),
    returns: Schema.Struct({
      attemptCount: Schema.Number,
      items: Schema.Array(
        Schema.Struct({
          calibrationStatus: Schema.Literal(
            "provisional",
            "emerging",
            "calibrated"
          ),
          correctRate: Schema.Number,
          difficulty: Schema.Number,
          discrimination: Schema.Number,
          questionId: GenericId.GenericId("exerciseQuestions"),
          responseCount: Schema.Number,
        })
      ),
      iterationCount: Schema.Number,
      maxParameterDelta: Schema.Number,
      model: Schema.Literal("2pl"),
      questionCount: Schema.Number,
      responseCount: Schema.Number,
    }),
  })
);

export { irtActionsInternalCalibrationGroup };

const irtActionsInternalGroup = GroupSpec.make("internalFunctions").addGroup(
  irtActionsInternalCalibrationGroup
);

export { irtActionsInternalGroup };

const irtActionsGroup = GroupSpec.make("actions").addGroup(
  irtActionsInternalGroup
);

export { irtActionsGroup };

const irtQueriesInternalCalibrationGroup = GroupSpec.make("calibration")
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getCalibrationQuestionsForSet",
      args: Schema.Struct({ setId: GenericId.GenericId("exerciseSets") }),
      returns: Schema.Struct({
        existingParams: Schema.Array(
          Schema.Struct({
            calibrationStatus: Schema.Literal(
              "provisional",
              "emerging",
              "calibrated"
            ),
            correctRate: Schema.Number,
            difficulty: Schema.Number,
            discrimination: Schema.Number,
            questionId: GenericId.GenericId("exerciseQuestions"),
            responseCount: Schema.Number,
          })
        ),
        questions: Schema.Array(
          Schema.Struct({
            questionId: GenericId.GenericId("exerciseQuestions"),
          })
        ),
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getCalibrationResponsesPageForSet",
      args: Schema.Struct({
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
        setId: GenericId.GenericId("exerciseSets"),
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        page: Schema.Array(
          Schema.Struct({
            attemptId: GenericId.GenericId("exerciseAttempts"),
            isCorrect: Schema.Boolean,
            questionId: GenericId.GenericId("exerciseQuestions"),
          })
        ),
        pageStatus: Schema.optional(
          Schema.Union(
            Schema.Literal("SplitRecommended"),
            Schema.Literal("SplitRequired"),
            Schema.Null
          )
        ),
        splitCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
      }),
    })
  );

export { irtQueriesInternalCalibrationGroup };

const irtQueriesInternalMaintenanceGroup = GroupSpec.make("maintenance")
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getCalibrationCacheIntegrity",
      args: Schema.Struct({
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        missingStatsSetCount: Schema.Number,
        oversizedSetCount: Schema.Number,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getScaleQualityIntegrity",
      args: Schema.Struct({
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        missingQualityCheckTryoutCount: Schema.Number,
        unstartableTryoutCount: Schema.Number,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getCalibrationQueueAttemptIntegrity",
      args: Schema.Struct({
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        duplicatePendingAttemptCount: Schema.Number,
        isDone: Schema.Boolean,
        missingPendingQueueAttemptCount: Schema.Number,
        staleAttemptQueueSetCount: Schema.Number,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getCalibrationQueueEntryIntegrity",
      args: Schema.Struct({
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        orphanedQueueEntryCount: Schema.Number,
        staleQueueEntryCount: Schema.Number,
      }),
    })
  );

export { irtQueriesInternalMaintenanceGroup };

const irtQueriesInternalGroup = GroupSpec.make("internalFunctions")
  .addGroup(irtQueriesInternalCalibrationGroup)
  .addGroup(irtQueriesInternalMaintenanceGroup);

export { irtQueriesInternalGroup };

const irtQueriesGroup = GroupSpec.make("queries").addGroup(
  irtQueriesInternalGroup
);

export { irtQueriesGroup };

const irtMutationsInternalCacheGroup = GroupSpec.make("cache")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "rebuildCalibrationCacheStatsForSet",
      args: Schema.Struct({
        cursor: Schema.optional(Schema.String),
        progress: Schema.optional(
          Schema.Struct({ attemptCount: Schema.Number })
        ),
        setId: GenericId.GenericId("exerciseSets"),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "trimCalibrationCacheForSet",
      args: Schema.Struct({ setId: GenericId.GenericId("exerciseSets") }),
      returns: Schema.Null,
    })
  );

export { irtMutationsInternalCacheGroup };

const irtMutationsInternalResponsesGroup = GroupSpec.make(
  "responses"
).addFunction(
  FunctionSpec.internalMutation({
    name: "syncCalibrationResponsesForAttempt",
    args: Schema.Struct({ attemptId: GenericId.GenericId("exerciseAttempts") }),
    returns: Schema.Null,
  })
);

export { irtMutationsInternalResponsesGroup };

const irtMutationsInternalQueueGroup = GroupSpec.make("queue")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cleanupCalibrationQueueEntries",
      args: Schema.Struct({
        setId: GenericId.GenericId("exerciseSets"),
        throughAt: Schema.Number,
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cleanupScalePublicationQueueEntries",
      args: Schema.Struct({ tryoutId: GenericId.GenericId("tryouts") }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "drainCalibrationQueue",
      args: Schema.Struct({}),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "enqueueScalePublication",
      args: Schema.Struct({ tryoutId: GenericId.GenericId("tryouts") }),
      returns: Schema.Null,
    })
  );

export { irtMutationsInternalQueueGroup };

const irtMutationsInternalRunsGroup = GroupSpec.make("runs")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "completeCalibrationRun",
      args: Schema.Struct({
        calibrationRunId: GenericId.GenericId("irtCalibrationRuns"),
        result: Schema.Struct({
          attemptCount: Schema.Number,
          items: Schema.Array(
            Schema.Struct({
              calibrationStatus: Schema.Literal(
                "provisional",
                "emerging",
                "calibrated"
              ),
              correctRate: Schema.Number,
              difficulty: Schema.Number,
              discrimination: Schema.Number,
              questionId: GenericId.GenericId("exerciseQuestions"),
              responseCount: Schema.Number,
            })
          ),
          iterationCount: Schema.Number,
          maxParameterDelta: Schema.Number,
          model: Schema.Literal("2pl"),
          questionCount: Schema.Number,
          responseCount: Schema.Number,
        }),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "failCalibrationRun",
      args: Schema.Struct({
        calibrationRunId: GenericId.GenericId("irtCalibrationRuns"),
        error: Schema.String,
      }),
      returns: Schema.Null,
    })
  );

export { irtMutationsInternalRunsGroup };

const irtMutationsInternalScalesGroup = GroupSpec.make("scales")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "drainScalePublicationQueue",
      args: Schema.Struct({}),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "drainScaleQualityRefreshQueue",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        processedCount: Schema.Number,
        scheduledCount: Schema.Number,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "rebuildScaleQualityChecksPage",
      args: Schema.Struct({ cursor: Schema.optional(Schema.String) }),
      returns: Schema.Struct({
        isDone: Schema.Boolean,
        processedCount: Schema.Number,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "refreshScaleQualityCheck",
      args: Schema.Struct({ tryoutId: GenericId.GenericId("tryouts") }),
      returns: Schema.Null,
    })
  );

export { irtMutationsInternalScalesGroup };

const irtMutationsInternalGroup = GroupSpec.make("internalFunctions")
  .addGroup(irtMutationsInternalCacheGroup)
  .addGroup(irtMutationsInternalResponsesGroup)
  .addGroup(irtMutationsInternalQueueGroup)
  .addGroup(irtMutationsInternalRunsGroup)
  .addGroup(irtMutationsInternalScalesGroup);

export { irtMutationsInternalGroup };

const irtMutationsGroup = GroupSpec.make("mutations").addGroup(
  irtMutationsInternalGroup
);

export { irtMutationsGroup };

const irtGroup = GroupSpec.make("irt")
  .addGroup(irtWorkflowsGroup)
  .addGroup(irtActionsGroup)
  .addGroup(irtQueriesGroup)
  .addGroup(irtMutationsGroup);

export { irtGroup };

import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const contentSyncMutationsMaintenanceGroup = GroupSpec.make("maintenance")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteArticleReferencesBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteArticlesBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteAuthorsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteContentAuthorsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteContentSearchBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteExerciseAnswersBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteExerciseAttemptsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteExerciseChoicesBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteExerciseItemParametersBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteExerciseQuestionsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteExerciseSetsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteIrtCalibrationAttemptsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteIrtCalibrationCacheStatsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteIrtCalibrationQueueBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteIrtCalibrationRunsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteIrtScalePublicationQueueBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteIrtScaleQualityChecksBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteIrtScaleQualityRefreshQueueBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteIrtScaleVersionItemsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteIrtScaleVersionsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteSubjectSectionsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteSubjectTopicsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteTryoutAccessCampaignProductsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteTryoutAccessCampaignsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteTryoutAccessGrantsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteTryoutAccessLinksBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteTryoutAttemptsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteTryoutCatalogMetaBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteTryoutEntitlementsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteTryoutLeaderboardEntriesBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteTryoutPartAttemptsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteTryoutPartSetsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteTryoutRuntimeBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteTryoutsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteUserTryoutStatsBatch",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        deleted: Schema.Number,
        hasMore: Schema.Boolean,
      }),
    })
  );

export { contentSyncMutationsMaintenanceGroup };

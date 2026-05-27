import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as content_sync_maintenance from "@repo/backend/confect/modules/content/contentSyncMaintenance.service";
import { Effect, Layer } from "effect";

const contentSync_mutations_maintenance_deleteArticleReferencesBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteArticleReferencesBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable("articleReferences")
  );

const contentSync_mutations_maintenance_deleteArticlesBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteArticlesBatch",
    (_args) => content_sync_maintenance.deleteBatchFromTable("articleContents")
  );

const contentSync_mutations_maintenance_deleteAuthorsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteAuthorsBatch",
    (_args) => content_sync_maintenance.deleteBatchFromTable("authors")
  );

const contentSync_mutations_maintenance_deleteContentAuthorsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteContentAuthorsBatch",
    (_args) => content_sync_maintenance.deleteBatchFromTable("contentAuthors")
  );

const contentSync_mutations_maintenance_deleteContentSearchBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteContentSearchBatch",
    (_args) => content_sync_maintenance.deleteBatchFromTable("contentSearch")
  );

const contentSync_mutations_maintenance_deleteExerciseAnswersBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseAnswersBatch",
    (_args) => content_sync_maintenance.deleteBatchFromTable("exerciseAnswers")
  );

const contentSync_mutations_maintenance_deleteExerciseAttemptsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseAttemptsBatch",
    (_args) => content_sync_maintenance.deleteBatchFromTable("exerciseAttempts")
  );

const contentSync_mutations_maintenance_deleteExerciseChoicesBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseChoicesBatch",
    (_args) => content_sync_maintenance.deleteBatchFromTable("exerciseChoices")
  );

const contentSync_mutations_maintenance_deleteExerciseItemParametersBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseItemParametersBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable("exerciseItemParameters")
  );

const contentSync_mutations_maintenance_deleteExerciseQuestionsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseQuestionsBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable("exerciseQuestions")
  );

const contentSync_mutations_maintenance_deleteExerciseSetsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseSetsBatch",
    (_args) => content_sync_maintenance.deleteBatchFromTable("exerciseSets")
  );

const contentSync_mutations_maintenance_deleteIrtCalibrationAttemptsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtCalibrationAttemptsBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable("irtCalibrationAttempts")
  );

const contentSync_mutations_maintenance_deleteIrtCalibrationCacheStatsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtCalibrationCacheStatsBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable("irtCalibrationCacheStats")
  );

const contentSync_mutations_maintenance_deleteIrtCalibrationQueueBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtCalibrationQueueBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable("irtCalibrationQueue")
  );

const contentSync_mutations_maintenance_deleteIrtCalibrationRunsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtCalibrationRunsBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable("irtCalibrationRuns")
  );

const contentSync_mutations_maintenance_deleteIrtScalePublicationQueueBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtScalePublicationQueueBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable("irtScalePublicationQueue")
  );

const contentSync_mutations_maintenance_deleteIrtScaleQualityChecksBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtScaleQualityChecksBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable("irtScaleQualityChecks")
  );

const contentSync_mutations_maintenance_deleteIrtScaleQualityRefreshQueueBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtScaleQualityRefreshQueueBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable(
        "irtScaleQualityRefreshQueue"
      )
  );

const contentSync_mutations_maintenance_deleteIrtScaleVersionItemsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtScaleVersionItemsBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable("irtScaleVersionItems")
  );

const contentSync_mutations_maintenance_deleteIrtScaleVersionsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtScaleVersionsBatch",
    (_args) => content_sync_maintenance.deleteBatchFromTable("irtScaleVersions")
  );

const contentSync_mutations_maintenance_deleteSubjectSectionsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteSubjectSectionsBatch",
    (_args) => content_sync_maintenance.deleteBatchFromTable("subjectSections")
  );

const contentSync_mutations_maintenance_deleteSubjectTopicsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteSubjectTopicsBatch",
    (_args) => content_sync_maintenance.deleteBatchFromTable("subjectTopics")
  );

const contentSync_mutations_maintenance_deleteTryoutAccessCampaignProductsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAccessCampaignProductsBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable(
        "tryoutAccessCampaignProducts"
      )
  );

const contentSync_mutations_maintenance_deleteTryoutAccessCampaignsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAccessCampaignsBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable("tryoutAccessCampaigns")
  );

const contentSync_mutations_maintenance_deleteTryoutAccessGrantsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAccessGrantsBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable("tryoutAccessGrants")
  );

const contentSync_mutations_maintenance_deleteTryoutAccessLinksBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAccessLinksBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable("tryoutAccessLinks")
  );

const contentSync_mutations_maintenance_deleteTryoutAttemptsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAttemptsBatch",
    (_args) => content_sync_maintenance.deleteBatchFromTable("tryoutAttempts")
  );

const contentSync_mutations_maintenance_deleteTryoutCatalogMetaBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutCatalogMetaBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable("tryoutCatalogMeta")
  );

const contentSync_mutations_maintenance_deleteTryoutEntitlementsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutEntitlementsBatch",
    (_args) => content_sync_maintenance.deleteTryoutEntitlementsBatch()
  );

const contentSync_mutations_maintenance_deleteTryoutLeaderboardEntriesBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutLeaderboardEntriesBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable("tryoutLeaderboardEntries")
  );

const contentSync_mutations_maintenance_deleteTryoutPartAttemptsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutPartAttemptsBatch",
    (_args) =>
      content_sync_maintenance.deleteBatchFromTable("tryoutPartAttempts")
  );

const contentSync_mutations_maintenance_deleteTryoutPartSetsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutPartSetsBatch",
    (_args) => content_sync_maintenance.deleteBatchFromTable("tryoutPartSets")
  );

const contentSync_mutations_maintenance_deleteTryoutRuntimeBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutRuntimeBatch",
    (_args) =>
      content_sync_maintenance
        .deleteTryoutRuntimeBatch()
        .pipe(
          Effect.catchTag("ContentSyncMaintenanceError", (error) =>
            Effect.die(error)
          )
        )
  );

const contentSync_mutations_maintenance_deleteTryoutsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutsBatch",
    (_args) => content_sync_maintenance.deleteBatchFromTable("tryouts")
  );

const contentSync_mutations_maintenance_deleteUserTryoutStatsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteUserTryoutStatsBatch",
    (_args) => content_sync_maintenance.deleteBatchFromTable("userTryoutStats")
  );

const contentSyncMutationsMaintenanceImpl = GroupImpl.make(
  api,
  "contentSync.mutations.maintenance"
)
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteArticleReferencesBatchImpl
    )
  )
  .pipe(
    Layer.provide(contentSync_mutations_maintenance_deleteArticlesBatchImpl)
  )
  .pipe(Layer.provide(contentSync_mutations_maintenance_deleteAuthorsBatchImpl))
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteContentAuthorsBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteContentSearchBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteExerciseAnswersBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteExerciseAttemptsBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteExerciseChoicesBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteExerciseItemParametersBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteExerciseQuestionsBatchImpl
    )
  )
  .pipe(
    Layer.provide(contentSync_mutations_maintenance_deleteExerciseSetsBatchImpl)
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteIrtCalibrationAttemptsBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteIrtCalibrationCacheStatsBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteIrtCalibrationQueueBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteIrtCalibrationRunsBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteIrtScalePublicationQueueBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteIrtScaleQualityChecksBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteIrtScaleQualityRefreshQueueBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteIrtScaleVersionItemsBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteIrtScaleVersionsBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteSubjectSectionsBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteSubjectTopicsBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteTryoutAccessCampaignProductsBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteTryoutAccessCampaignsBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteTryoutAccessGrantsBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteTryoutAccessLinksBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteTryoutAttemptsBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteTryoutCatalogMetaBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteTryoutEntitlementsBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteTryoutLeaderboardEntriesBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteTryoutPartAttemptsBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteTryoutPartSetsBatchImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteTryoutRuntimeBatchImpl
    )
  )
  .pipe(Layer.provide(contentSync_mutations_maintenance_deleteTryoutsBatchImpl))
  .pipe(
    Layer.provide(
      contentSync_mutations_maintenance_deleteUserTryoutStatsBatchImpl
    )
  );

export { contentSyncMutationsMaintenanceImpl };

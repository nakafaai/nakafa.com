import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  deleteBatchFromTable as contentSyncMaintenance_deleteBatchFromTable,
  deleteTryoutEntitlementsBatch as contentSyncMaintenance_deleteTryoutEntitlementsBatch,
  deleteTryoutRuntimeBatch as contentSyncMaintenance_deleteTryoutRuntimeBatch,
} from "@repo/backend/confect/modules/content/contentSyncMaintenance.service";
import { Effect, Layer } from "effect";

const contentSync_mutations_maintenance_deleteArticleReferencesBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteArticleReferencesBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("articleReferences")
  );

const contentSync_mutations_maintenance_deleteArticlesBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteArticlesBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("articleContents")
  );

const contentSync_mutations_maintenance_deleteAuthorsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteAuthorsBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("authors")
  );

const contentSync_mutations_maintenance_deleteContentAuthorsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteContentAuthorsBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("contentAuthors")
  );

const contentSync_mutations_maintenance_deleteContentSearchBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteContentSearchBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("contentSearch")
  );

const contentSync_mutations_maintenance_deleteExerciseAnswersBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseAnswersBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("exerciseAnswers")
  );

const contentSync_mutations_maintenance_deleteExerciseAttemptsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseAttemptsBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("exerciseAttempts")
  );

const contentSync_mutations_maintenance_deleteExerciseChoicesBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseChoicesBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("exerciseChoices")
  );

const contentSync_mutations_maintenance_deleteExerciseItemParametersBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseItemParametersBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("exerciseItemParameters")
  );

const contentSync_mutations_maintenance_deleteExerciseQuestionsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseQuestionsBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("exerciseQuestions")
  );

const contentSync_mutations_maintenance_deleteExerciseSetsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseSetsBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("exerciseSets")
  );

const contentSync_mutations_maintenance_deleteIrtCalibrationAttemptsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtCalibrationAttemptsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("irtCalibrationAttempts")
  );

const contentSync_mutations_maintenance_deleteIrtCalibrationCacheStatsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtCalibrationCacheStatsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("irtCalibrationCacheStats")
  );

const contentSync_mutations_maintenance_deleteIrtCalibrationQueueBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtCalibrationQueueBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("irtCalibrationQueue")
  );

const contentSync_mutations_maintenance_deleteIrtCalibrationRunsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtCalibrationRunsBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("irtCalibrationRuns")
  );

const contentSync_mutations_maintenance_deleteIrtScalePublicationQueueBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtScalePublicationQueueBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("irtScalePublicationQueue")
  );

const contentSync_mutations_maintenance_deleteIrtScaleQualityChecksBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtScaleQualityChecksBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("irtScaleQualityChecks")
  );

const contentSync_mutations_maintenance_deleteIrtScaleQualityRefreshQueueBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtScaleQualityRefreshQueueBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("irtScaleQualityRefreshQueue")
  );

const contentSync_mutations_maintenance_deleteIrtScaleVersionItemsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtScaleVersionItemsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("irtScaleVersionItems")
  );

const contentSync_mutations_maintenance_deleteIrtScaleVersionsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtScaleVersionsBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("irtScaleVersions")
  );

const contentSync_mutations_maintenance_deleteSubjectSectionsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteSubjectSectionsBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("subjectSections")
  );

const contentSync_mutations_maintenance_deleteSubjectTopicsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteSubjectTopicsBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("subjectTopics")
  );

const contentSync_mutations_maintenance_deleteTryoutAccessCampaignProductsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAccessCampaignProductsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable(
        "tryoutAccessCampaignProducts"
      )
  );

const contentSync_mutations_maintenance_deleteTryoutAccessCampaignsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAccessCampaignsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("tryoutAccessCampaigns")
  );

const contentSync_mutations_maintenance_deleteTryoutAccessGrantsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAccessGrantsBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("tryoutAccessGrants")
  );

const contentSync_mutations_maintenance_deleteTryoutAccessLinksBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAccessLinksBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("tryoutAccessLinks")
  );

const contentSync_mutations_maintenance_deleteTryoutAttemptsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAttemptsBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("tryoutAttempts")
  );

const contentSync_mutations_maintenance_deleteTryoutCatalogMetaBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutCatalogMetaBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("tryoutCatalogMeta")
  );

const contentSync_mutations_maintenance_deleteTryoutEntitlementsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutEntitlementsBatch",
    (_args) => contentSyncMaintenance_deleteTryoutEntitlementsBatch()
  );

const contentSync_mutations_maintenance_deleteTryoutLeaderboardEntriesBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutLeaderboardEntriesBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("tryoutLeaderboardEntries")
  );

const contentSync_mutations_maintenance_deleteTryoutPartAttemptsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutPartAttemptsBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("tryoutPartAttempts")
  );

const contentSync_mutations_maintenance_deleteTryoutPartSetsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutPartSetsBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("tryoutPartSets")
  );

const contentSync_mutations_maintenance_deleteTryoutRuntimeBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutRuntimeBatch",
    (_args) =>
      contentSyncMaintenance_deleteTryoutRuntimeBatch().pipe(
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
    (_args) => contentSyncMaintenance_deleteBatchFromTable("tryouts")
  );

const contentSync_mutations_maintenance_deleteUserTryoutStatsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteUserTryoutStatsBatch",
    (_args) => contentSyncMaintenance_deleteBatchFromTable("userTryoutStats")
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

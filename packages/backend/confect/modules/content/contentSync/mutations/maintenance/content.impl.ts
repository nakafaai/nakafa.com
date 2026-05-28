import { FunctionImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { deleteBatchFromTable as contentSyncMaintenance_deleteBatchFromTable } from "@repo/backend/confect/modules/content/contentSyncMaintenance.service";
import { Effect } from "effect";

export const contentSync_mutations_maintenance_deleteArticleReferencesBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteArticleReferencesBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("articleReferences").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteArticlesBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteArticlesBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("articleContents").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteAuthorsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteAuthorsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("authors").pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteContentAuthorsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteContentAuthorsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("contentAuthors").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteContentSearchBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteContentSearchBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("contentSearch").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteExerciseAnswersBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseAnswersBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("exerciseAnswers").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteExerciseAttemptsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseAttemptsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("exerciseAttempts").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteExerciseChoicesBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseChoicesBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("exerciseChoices").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteExerciseItemParametersBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseItemParametersBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable(
        "exerciseItemParameters"
      ).pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteExerciseQuestionsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseQuestionsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("exerciseQuestions").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteExerciseSetsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseSetsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("exerciseSets").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteSubjectSectionsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteSubjectSectionsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("subjectSections").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteSubjectTopicsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteSubjectTopicsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("subjectTopics").pipe(
        Effect.orDie
      )
  );

import { FunctionImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { deleteBatchFromTable } from "@repo/backend/confect/modules/content/contentSyncMaintenance.service";
import { Effect } from "effect";

export const contentSync_mutations_maintenance_deleteArticleReferencesBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteArticleReferencesBatch",
    (_args) => deleteBatchFromTable("articleReferences").pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteArticlesBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteArticlesBatch",
    (_args) => deleteBatchFromTable("articleContents").pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteAuthorsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteAuthorsBatch",
    (_args) => deleteBatchFromTable("authors").pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteContentAuthorsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteContentAuthorsBatch",
    (_args) => deleteBatchFromTable("contentAuthors").pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteContentSearchBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteContentSearchBatch",
    (_args) => deleteBatchFromTable("contentSearch").pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteExerciseAnswersBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseAnswersBatch",
    (_args) => deleteBatchFromTable("exerciseAnswers").pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteExerciseAttemptsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseAttemptsBatch",
    (_args) => deleteBatchFromTable("exerciseAttempts").pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteExerciseChoicesBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseChoicesBatch",
    (_args) => deleteBatchFromTable("exerciseChoices").pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteExerciseItemParametersBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseItemParametersBatch",
    (_args) => deleteBatchFromTable("exerciseItemParameters").pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteExerciseQuestionsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseQuestionsBatch",
    (_args) => deleteBatchFromTable("exerciseQuestions").pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteExerciseSetsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteExerciseSetsBatch",
    (_args) => deleteBatchFromTable("exerciseSets").pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteSubjectSectionsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteSubjectSectionsBatch",
    (_args) => deleteBatchFromTable("subjectSections").pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteSubjectTopicsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteSubjectTopicsBatch",
    (_args) => deleteBatchFromTable("subjectTopics").pipe(Effect.orDie)
  );

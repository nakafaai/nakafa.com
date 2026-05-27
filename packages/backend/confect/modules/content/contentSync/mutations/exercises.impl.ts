import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as content_sync_exercises from "@repo/backend/confect/modules/content/contentSyncExercises.service";
import { Effect, Layer } from "effect";

const contentSync_mutations_exercises_bulkSyncExerciseQuestionsImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.exercises",
    "bulkSyncExerciseQuestions",
    (args) =>
      content_sync_exercises
        .bulkSyncExerciseQuestions(args)
        .pipe(Effect.catchTag("ContentSyncError", (error) => Effect.die(error)))
  );

const contentSync_mutations_exercises_bulkSyncExerciseSetsImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.exercises",
    "bulkSyncExerciseSets",
    (args) =>
      content_sync_exercises
        .bulkSyncExerciseSets(args)
        .pipe(Effect.catchTag("ContentSyncError", (error) => Effect.die(error)))
  );

const contentSync_mutations_exercises_deleteStaleExerciseQuestionsImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.exercises",
    "deleteStaleExerciseQuestions",
    (args) =>
      content_sync_exercises
        .deleteStaleExerciseQuestions(args)
        .pipe(Effect.catchTag("ContentSyncError", (error) => Effect.die(error)))
  );

const contentSync_mutations_exercises_deleteStaleExerciseSetsImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.exercises",
    "deleteStaleExerciseSets",
    (args) =>
      content_sync_exercises
        .deleteStaleExerciseSets(args)
        .pipe(Effect.catchTag("ContentSyncError", (error) => Effect.die(error)))
  );

const contentSyncMutationsExercisesImpl = GroupImpl.make(
  api,
  "contentSync.mutations.exercises"
)
  .pipe(
    Layer.provide(contentSync_mutations_exercises_bulkSyncExerciseQuestionsImpl)
  )
  .pipe(Layer.provide(contentSync_mutations_exercises_bulkSyncExerciseSetsImpl))
  .pipe(
    Layer.provide(
      contentSync_mutations_exercises_deleteStaleExerciseQuestionsImpl
    )
  )
  .pipe(
    Layer.provide(contentSync_mutations_exercises_deleteStaleExerciseSetsImpl)
  );

export { contentSyncMutationsExercisesImpl };

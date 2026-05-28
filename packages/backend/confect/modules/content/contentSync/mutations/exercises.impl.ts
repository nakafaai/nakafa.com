import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  bulkSyncExerciseQuestions as contentSyncExercises_bulkSyncExerciseQuestions,
  bulkSyncExerciseSets as contentSyncExercises_bulkSyncExerciseSets,
  deleteStaleExerciseQuestions as contentSyncExercises_deleteStaleExerciseQuestions,
  deleteStaleExerciseSets as contentSyncExercises_deleteStaleExerciseSets,
} from "@repo/backend/confect/modules/content/contentSyncExercises.service";
import { Effect, Layer } from "effect";

const contentSync_mutations_exercises_bulkSyncExerciseQuestionsImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.exercises",
    "bulkSyncExerciseQuestions",
    (args) =>
      contentSyncExercises_bulkSyncExerciseQuestions(args).pipe(
        Effect.catchTag("ContentSyncError", (error) => Effect.die(error))
      )
  );

const contentSync_mutations_exercises_bulkSyncExerciseSetsImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.exercises",
    "bulkSyncExerciseSets",
    (args) =>
      contentSyncExercises_bulkSyncExerciseSets(args).pipe(
        Effect.catchTag("ContentSyncError", (error) => Effect.die(error))
      )
  );

const contentSync_mutations_exercises_deleteStaleExerciseQuestionsImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.exercises",
    "deleteStaleExerciseQuestions",
    (args) =>
      contentSyncExercises_deleteStaleExerciseQuestions(args).pipe(
        Effect.catchTag("ContentSyncError", (error) => Effect.die(error))
      )
  );

const contentSync_mutations_exercises_deleteStaleExerciseSetsImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.exercises",
    "deleteStaleExerciseSets",
    (args) =>
      contentSyncExercises_deleteStaleExerciseSets(args).pipe(
        Effect.catchTag("ContentSyncError", (error) => Effect.die(error))
      )
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

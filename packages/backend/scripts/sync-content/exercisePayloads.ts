import type { Ref } from "@confect/core";
import type refs from "@repo/backend/confect/_generated/refs";

type BulkSyncExerciseSetsArgs = Ref.Args<
  typeof refs.internal.contentSync.mutations.exercises.bulkSyncExerciseSets
>;

type BulkSyncExerciseQuestionsArgs = Ref.Args<
  typeof refs.internal.contentSync.mutations.exercises.bulkSyncExerciseQuestions
>;

export type ExerciseSetPayload = BulkSyncExerciseSetsArgs["sets"][number];

export type ExerciseQuestionPayload =
  BulkSyncExerciseQuestionsArgs["questions"][number];

export type QuestionChoice = ExerciseQuestionPayload["choices"][number];

export interface ExerciseSearchLabels {
  exerciseTypeTitle: string;
  setTitle: string;
}

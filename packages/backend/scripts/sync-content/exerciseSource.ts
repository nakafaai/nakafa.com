import type { internal } from "@repo/backend/convex/_generated/api";
import type { SyncOptions } from "@repo/backend/scripts/sync-content/types";
import type { PracticeMaterialSetProjection } from "@repo/contents/_types/material/projection";
import { listPracticeSets } from "@repo/contents/_types/material/registry";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";

export type ExerciseQuestionPayload = FunctionArgs<
  typeof internal.contentSync.mutations.exercises.bulkSyncExerciseQuestions
>["questions"][number];

export type ExerciseQuestionChoices = ExerciseQuestionPayload["choices"];

export interface ExerciseSearchLabels {
  exerciseTypeTitle: string;
  setTitle: string;
}

/**
 * Maps source-owned assessment identity into the Convex exercise category field.
 *
 * This keeps the sync payload derived from the typed practice material source
 * instead of from localized route text or script-local category maps.
 */
export function readPracticeCategory(
  assessment: PracticeMaterialSetProjection["assessment"]
): ExerciseQuestionPayload["category"] {
  if (assessment === "grade-9") {
    return "middle-school";
  }

  return "high-school";
}

/**
 * Builds locale-scoped set labels from typed practice material sources.
 *
 * Question search text inherits authored exercise titles from the source
 * registry, so question MDX files do not need to duplicate set-level copy.
 */
export const readExerciseSearchLabels = (options: SyncOptions) =>
  Effect.sync(() => {
    const labels = new Map<string, ExerciseSearchLabels>();

    for (const set of listPracticeSets(options.locale)) {
      labels.set(`${set.locale}:${set.slug}`, {
        exerciseTypeTitle: set.exerciseTypeTitle,
        setTitle: set.title,
      });
    }

    return labels;
  });

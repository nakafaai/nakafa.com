import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  loadValidatedScaleSetData,
  loadValidatedScaleTryoutSets,
} from "@repo/backend/confect/modules/tryout/irtScaleLoaders.service";
import { Effect } from "effect";

interface SnapshotItem {
  readonly calibrationRunId: Id<"irtCalibrationRuns">;
  readonly difficulty: number;
  readonly discrimination: number;
  readonly questionId: Id<"exerciseQuestions">;
  readonly setId: Id<"exerciseSets">;
}

/** Compares a frozen scale version with a publishable snapshot. */
export function hasPublishedScaleChanged(args: {
  readonly publishedItems: readonly Doc<"irtScaleVersionItems">[];
  readonly snapshotItems: readonly SnapshotItem[];
}) {
  if (args.publishedItems.length !== args.snapshotItems.length) {
    return true;
  }

  const publishedByQuestionId = new Map(
    args.publishedItems.map((item) => [item.questionId, item])
  );

  for (const snapshotItem of args.snapshotItems) {
    const publishedItem = publishedByQuestionId.get(snapshotItem.questionId);

    if (!publishedItem) {
      return true;
    }

    if (publishedItem.calibrationRunId !== snapshotItem.calibrationRunId) {
      return true;
    }
  }

  return false;
}

/** Builds a publishable official scale snapshot when all items are calibrated. */
export const getPublishableScaleSnapshot = Effect.fnUntraced(function* (
  tryoutId: Id<"tryouts">
) {
  const reader = yield* DatabaseReader;
  const tryout = yield* reader
    .table("tryouts")
    .get(tryoutId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!tryout) {
    return null;
  }

  const tryoutSets = yield* loadValidatedScaleTryoutSets(tryout);
  const perSetData = yield* Effect.all(
    tryoutSets.map(({ set }) =>
      Effect.gen(function* () {
        const { itemParams, questions } = yield* loadValidatedScaleSetData(set);
        const paramsByQuestionId = new Map(
          itemParams.map((params) => [params.questionId, params])
        );
        const calibratedItems = questions.flatMap((question) => {
          const params = paramsByQuestionId.get(question._id);

          if (
            !params ||
            params.calibrationStatus !== "calibrated" ||
            params.calibrationRunId === undefined
          ) {
            return [];
          }

          return [
            {
              calibrationRunId: params.calibrationRunId,
              difficulty: params.difficulty,
              discrimination: params.discrimination,
              questionId: question._id,
              setId: set._id,
            },
          ];
        });

        if (calibratedItems.length !== questions.length) {
          return null;
        }

        return calibratedItems;
      })
    )
  );
  const validSetData = perSetData.filter((setItems) => setItems !== null);

  if (validSetData.length !== perSetData.length) {
    return null;
  }

  const items = validSetData.flat();

  return {
    items,
    questionCount: items.length,
  };
});

import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  loadValidatedScaleSetData,
  loadValidatedScaleTryoutSets,
} from "@repo/backend/convex/irt/scales/loaders";
import type { ScaleVersionItemSnapshot } from "@repo/backend/convex/irt/scales/read";

type IrtDbReader = QueryCtx["db"];

/** Compares a publishable scale snapshot against an existing published version. */
export function hasPublishedScaleChanged({
  publishedItems,
  snapshotItems,
}: {
  publishedItems: Doc<"irtScaleVersionItems">[];
  snapshotItems: ScaleVersionItemSnapshot[];
}) {
  if (publishedItems.length !== snapshotItems.length) {
    return true;
  }

  const publishedByQuestionId = new Map(
    publishedItems.map((item) => [item.questionId, item])
  );

  for (const snapshotItem of snapshotItems) {
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

/**
 * Build a publishable frozen scale snapshot for one tryout.
 *
 * The snapshot only exists when every question across every validated tryout
 * part has a calibrated item parameter tied to a concrete calibration run.
 */
export async function getPublishableScaleSnapshot(
  db: IrtDbReader,
  tryoutId: Id<"tryouts">
) {
  const tryout = await db.get("tryouts", tryoutId);

  if (!tryout) {
    return null;
  }

  const tryoutSets = await loadValidatedScaleTryoutSets(db, tryout);
  const perSetData = await Promise.all(
    tryoutSets.map(async ({ set }) => {
      const { itemParams, questions } = await loadValidatedScaleSetData(
        db,
        set
      );
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
            questionId: question._id,
            setId: set._id,
            difficulty: params.difficulty,
            discrimination: params.discrimination,
            calibrationRunId: params.calibrationRunId,
          },
        ];
      });

      if (calibratedItems.length !== questions.length) {
        return null;
      }

      return calibratedItems;
    })
  );

  const items: ScaleVersionItemSnapshot[] = [];

  for (const setItems of perSetData) {
    if (!setItems) {
      return null;
    }

    items.push(...setItems);
  }

  return {
    questionCount: items.length,
    items,
  };
}

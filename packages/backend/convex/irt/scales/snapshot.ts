import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type { ScaleVersionItemSnapshot } from "@repo/backend/convex/irt/scales/read";
import { getAll, getManyFrom } from "convex-helpers/server/relationships";

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

/** Builds a publishable frozen scale snapshot for one tryout. */
export async function getPublishableScaleSnapshot(
  db: IrtDbReader,
  tryoutId: Id<"tryouts">
) {
  const [tryout, tryoutPartSets] = await Promise.all([
    db.get("tryouts", tryoutId),
    getManyFrom(
      db,
      "tryoutPartSets",
      "tryoutId_partIndex",
      tryoutId,
      "tryoutId"
    ),
  ]);

  if (!tryout) {
    return null;
  }

  const sets = await getAll(
    db,
    "exerciseSets",
    tryoutPartSets.map((partSet) => partSet.setId)
  );

  const perSetData = await Promise.all(
    tryoutPartSets.map(async (partSet, index) => {
      const set = sets[index];

      if (!set) {
        return null;
      }

      const [questions, itemParams] = await Promise.all([
        getManyFrom(db, "exerciseQuestions", "setId", partSet.setId, "setId"),
        getManyFrom(
          db,
          "exerciseItemParameters",
          "by_setId",
          partSet.setId,
          "setId"
        ),
      ]);

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

import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { IRT_OPERATIONAL_MODEL } from "@repo/backend/convex/irt/policy";
import { asyncMap } from "convex-helpers";
import { getManyFrom } from "convex-helpers/server/relationships";

type IrtDbReader = QueryCtx["db"];
type IrtDbWriter = MutationCtx["db"];
type OperationalItemParams = Pick<
  Doc<"exerciseItemParameters">,
  "questionId" | "difficulty" | "discrimination" | "guessing"
>;
type ScaleVersionItemsBySetId = Map<
  Doc<"irtScaleVersionItems">["setId"],
  Doc<"irtScaleVersionItems">[]
>;
type ScaleVersionItemSnapshot = OperationalItemParams &
  Pick<Doc<"irtScaleVersionItems">, "setId"> & {
    calibrationRunId: Doc<"irtScaleVersionItems">["calibrationRunId"];
  };

/**
 * Load the latest published scale version for a try-out.
 */
export function getLatestScaleVersionForTryout(
  db: IrtDbReader,
  tryoutId: Doc<"irtScaleVersions">["tryoutId"]
) {
  return db
    .query("irtScaleVersions")
    .withIndex("tryoutId_publishedAt", (q) => q.eq("tryoutId", tryoutId))
    .order("desc")
    .first();
}

/**
 * Load all frozen item parameters in one published scale version.
 */
export function getScaleVersionItems(
  db: IrtDbReader,
  scaleVersionId: Doc<"irtScaleVersionItems">["scaleVersionId"]
) {
  return getManyFrom(
    db,
    "irtScaleVersionItems",
    "scaleVersionId_setId_questionId",
    scaleVersionId,
    "scaleVersionId"
  );
}

/**
 * Compare a publishable snapshot with an already published scale version.
 */
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
 * Group frozen scale-version items by `setId` for efficient per-subject lookups.
 */
export function groupScaleVersionItemsBySetId(
  items: Doc<"irtScaleVersionItems">[]
) {
  const itemsBySetId: ScaleVersionItemsBySetId = new Map();

  for (const item of items) {
    const itemsForSet = itemsBySetId.get(item.setId) ?? [];
    itemsForSet.push(item);
    itemsBySetId.set(item.setId, itemsForSet);
  }

  return itemsBySetId;
}

/**
 * Load the frozen item parameters for one set inside a published scale version.
 */
export function getScaleVersionItemsForSet(
  db: IrtDbReader,
  {
    scaleVersionId,
    setId,
  }: Pick<Doc<"irtScaleVersionItems">, "scaleVersionId" | "setId">
) {
  return db
    .query("irtScaleVersionItems")
    .withIndex("scaleVersionId_setId_questionId", (q) =>
      q.eq("scaleVersionId", scaleVersionId).eq("setId", setId)
    )
    .collect();
}

/**
 * Build a publishable scale-version snapshot for one try-out.
 *
 * Returns `null` when any question in the try-out is still missing calibrated
 * parameters, so official simulation attempts cannot start on an unstable scale.
 */
export async function getPublishableScaleSnapshot(
  db: IrtDbReader,
  tryoutId: Doc<"snbtTryouts">["_id"]
) {
  const tryoutSets = await getManyFrom(
    db,
    "snbtTryoutSets",
    "tryoutId_subjectIndex",
    tryoutId,
    "tryoutId"
  );

  const perSetData = await asyncMap(tryoutSets, async (tryoutSet) => {
    const [questions, itemParams] = await Promise.all([
      getManyFrom(db, "exerciseQuestions", "setId", tryoutSet.setId),
      getManyFrom(db, "exerciseItemParameters", "setId", tryoutSet.setId),
    ]);

    return {
      setId: tryoutSet.setId,
      itemParams,
      questions,
    };
  });

  const items = perSetData.flatMap(({ setId, itemParams, questions }) => {
    const paramsByQuestionId = new Map(
      itemParams.map((params) => [params.questionId, params])
    );

    return questions.flatMap((question) => {
      const params = paramsByQuestionId.get(question._id);

      if (
        !params ||
        params.calibrationStatus !== "calibrated" ||
        params.calibrationRunId === undefined
      ) {
        return [];
      }

      const item: ScaleVersionItemSnapshot = {
        questionId: question._id,
        setId,
        difficulty: params.difficulty,
        discrimination: params.discrimination,
        guessing: params.guessing,
        calibrationRunId: params.calibrationRunId,
      };

      return [item];
    });
  });

  const questionCount = perSetData.reduce(
    (count, { questions }) => count + questions.length,
    0
  );

  if (items.length !== questionCount) {
    return null;
  }

  return {
    model: IRT_OPERATIONAL_MODEL,
    questionCount,
    items,
  };
}

/**
 * Publish a frozen scale version for a calibrated try-out.
 */
export async function publishScaleVersion(
  db: IrtDbWriter,
  {
    publishedAt,
    questionCount,
    tryoutId,
    items,
  }: {
    publishedAt: number;
    questionCount: number;
    tryoutId: Doc<"irtScaleVersions">["tryoutId"];
    items: ScaleVersionItemSnapshot[];
  }
) {
  const scaleVersionId = await db.insert("irtScaleVersions", {
    tryoutId,
    model: IRT_OPERATIONAL_MODEL,
    questionCount,
    publishedAt,
  });

  await asyncMap(items, (item) =>
    db.insert("irtScaleVersionItems", {
      scaleVersionId,
      calibrationRunId: item.calibrationRunId,
      questionId: item.questionId,
      setId: item.setId,
      difficulty: item.difficulty,
      discrimination: item.discrimination,
      guessing: item.guessing,
    })
  );

  return scaleVersionId;
}

import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { getProvisionalParams } from "@repo/backend/convex/irt/estimation";
import { IRT_OPERATIONAL_MODEL } from "@repo/backend/convex/irt/policy";
import { ConvexError } from "convex/values";
import { asyncMap } from "convex-helpers";
import { getAll, getManyFrom } from "convex-helpers/server/relationships";

const MAX_ACTIVE_TRYOUTS_WITHOUT_SCALE = 100;

type IrtDbReader = QueryCtx["db"];
type IrtDbWriter = MutationCtx["db"];
type OperationalItemParams = Pick<
  Doc<"exerciseItemParameters">,
  "questionId" | "difficulty" | "discrimination"
>;
type ActiveTryoutWithoutScale = Pick<
  Doc<"tryouts">,
  "_id" | "cycleKey" | "locale" | "product" | "slug"
>;
type ScaleVersionItemSnapshot = OperationalItemParams &
  Pick<Doc<"irtScaleVersionItems">, "setId"> & {
    calibrationRunId: Doc<"irtScaleVersionItems">["calibrationRunId"];
  };

/** Returns the scoring maturity of one published tryout scale version. */
export function getScaleVersionStatus(
  scaleVersion: Pick<Doc<"irtScaleVersions">, "status">
) {
  return scaleVersion.status;
}

/**
 * Load the latest published scale version for a try-out.
 */
export function getLatestScaleVersionForTryout(
  db: IrtDbReader,
  tryoutId: Doc<"irtScaleVersions">["tryoutId"]
) {
  return db
    .query("irtScaleVersions")
    .withIndex("by_tryoutId_and_publishedAt", (q) => q.eq("tryoutId", tryoutId))
    .order("desc")
    .first();
}

/** Lists active tryouts that still do not have a frozen scale version. */
export async function getActiveTryoutsWithoutScale(db: IrtDbReader) {
  const tryouts = await db
    .query("tryouts")
    .withIndex("isActive", (q) => q.eq("isActive", true))
    .take(MAX_ACTIVE_TRYOUTS_WITHOUT_SCALE + 1);

  if (tryouts.length > MAX_ACTIVE_TRYOUTS_WITHOUT_SCALE) {
    throw new ConvexError({
      code: "IRT_ACTIVE_TRYOUT_LIMIT_EXCEEDED",
      message: "Too many active tryouts to audit scale coverage safely.",
    });
  }

  const latestScaleVersions = await asyncMap(tryouts, (tryout) =>
    getLatestScaleVersionForTryout(db, tryout._id)
  );
  const activeTryoutsWithoutScale: ActiveTryoutWithoutScale[] = [];

  for (const [index, tryout] of tryouts.entries()) {
    const scaleVersion = latestScaleVersions[index];

    if (scaleVersion) {
      continue;
    }

    activeTryoutsWithoutScale.push({
      _id: tryout._id,
      cycleKey: tryout.cycleKey,
      locale: tryout.locale,
      product: tryout.product,
      slug: tryout.slug,
    });
  }

  return activeTryoutsWithoutScale;
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
    "by_scaleVersionId_and_setId_and_questionId",
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
    .withIndex("by_scaleVersionId_and_setId_and_questionId", (q) =>
      q.eq("scaleVersionId", scaleVersionId).eq("setId", setId)
    )
    .collect();
}

/**
 * Build a publishable frozen scale snapshot for one try-out.
 *
 * Returns `null` when any question in the try-out is still missing calibrated
 * parameters, so official simulation attempts cannot start on an unstable scale.
 */
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

  const perSetData = await asyncMap(tryoutPartSets, async (partSet, index) => {
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
  });

  const items: ScaleVersionItemSnapshot[] = [];

  for (const setItems of perSetData) {
    if (!setItems) {
      return null;
    }

    items.push(...setItems);
  }

  return {
    model: IRT_OPERATIONAL_MODEL,
    questionCount: items.length,
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
    status,
    tryoutId,
    items,
  }: {
    publishedAt: number;
    questionCount: number;
    status: NonNullable<Doc<"irtScaleVersions">["status"]>;
    tryoutId: Doc<"irtScaleVersions">["tryoutId"];
    items: ScaleVersionItemSnapshot[];
  }
) {
  const scaleVersionId = await db.insert("irtScaleVersions", {
    tryoutId,
    model: IRT_OPERATIONAL_MODEL,
    status,
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
    })
  );

  return scaleVersionId;
}

function createBootstrapCalibrationRun(
  db: IrtDbWriter,
  {
    now,
    questionCount,
    setId,
  }: {
    now: number;
    questionCount: number;
    setId: Id<"exerciseSets">;
  }
) {
  return db.insert("irtCalibrationRuns", {
    setId,
    model: IRT_OPERATIONAL_MODEL,
    status: "completed",
    questionCount,
    responseCount: 0,
    attemptCount: 0,
    iterationCount: 0,
    maxParameterDelta: 0,
    startedAt: now,
    updatedAt: now,
    completedAt: now,
  });
}

/**
 * Publishes an initial frozen scale version so active tryouts stay startable
 * even before enough simulation data exists for full calibration.
 */
export async function publishBootstrapScaleVersion(
  db: IrtDbWriter,
  {
    now,
    tryoutId,
  }: {
    now: number;
    tryoutId: Id<"tryouts">;
  }
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

  if (!tryout || tryoutPartSets.length === 0) {
    return null;
  }

  const sets = await getAll(
    db,
    "exerciseSets",
    tryoutPartSets.map((partSet) => partSet.setId)
  );
  const bootstrapRunIds = new Map<
    Id<"exerciseSets">,
    Id<"irtCalibrationRuns">
  >();
  const items: ScaleVersionItemSnapshot[] = [];

  for (const [index, partSet] of tryoutPartSets.entries()) {
    const set = sets[index];

    if (!set) {
      return null;
    }

    const [questions, existingParams] = await Promise.all([
      getManyFrom(db, "exerciseQuestions", "setId", partSet.setId, "setId"),
      getManyFrom(
        db,
        "exerciseItemParameters",
        "by_setId",
        partSet.setId,
        "setId"
      ),
    ]);

    if (questions.length === 0) {
      return null;
    }

    const paramsByQuestionId = new Map(
      existingParams.map((params) => [params.questionId, params])
    );
    const bootstrapRunId = await createBootstrapCalibrationRun(db, {
      now,
      questionCount: questions.length,
      setId: partSet.setId,
    });
    bootstrapRunIds.set(partSet.setId, bootstrapRunId);

    for (const question of questions) {
      const params = paramsByQuestionId.get(question._id);
      const provisional = getProvisionalParams();

      items.push({
        questionId: question._id,
        setId: partSet.setId,
        difficulty: params?.difficulty ?? provisional.difficulty,
        discrimination: params?.discrimination ?? provisional.discrimination,
        calibrationRunId: params?.calibrationRunId ?? bootstrapRunId,
      });
    }
  }

  const scaleVersionId = await publishScaleVersion(db, {
    tryoutId,
    questionCount: items.length,
    items,
    status: "provisional",
    publishedAt: now,
  });

  return db.get("irtScaleVersions", scaleVersionId);
}

/** Returns an existing frozen scale version or bootstraps one if needed. */
export async function getOrPublishScaleVersionForTryout(
  db: IrtDbWriter,
  {
    now,
    tryoutId,
  }: {
    now: number;
    tryoutId: Id<"tryouts">;
  }
) {
  const latestScaleVersion = await getLatestScaleVersionForTryout(db, tryoutId);
  const publishableSnapshot = await getPublishableScaleSnapshot(db, tryoutId);

  if (latestScaleVersion) {
    if (!publishableSnapshot) {
      return latestScaleVersion;
    }

    if (getScaleVersionStatus(latestScaleVersion) === "official") {
      const latestScaleItems = await getScaleVersionItems(
        db,
        latestScaleVersion._id
      );

      if (
        !hasPublishedScaleChanged({
          publishedItems: latestScaleItems,
          snapshotItems: publishableSnapshot.items,
        })
      ) {
        return latestScaleVersion;
      }
    }

    const scaleVersionId = await publishScaleVersion(db, {
      tryoutId,
      questionCount: publishableSnapshot.questionCount,
      items: publishableSnapshot.items,
      status: "official",
      publishedAt: now,
    });

    return db.get("irtScaleVersions", scaleVersionId);
  }

  if (publishableSnapshot) {
    const scaleVersionId = await publishScaleVersion(db, {
      tryoutId,
      questionCount: publishableSnapshot.questionCount,
      items: publishableSnapshot.items,
      status: "official",
      publishedAt: now,
    });

    return db.get("irtScaleVersions", scaleVersionId);
  }

  return publishBootstrapScaleVersion(db, { now, tryoutId });
}

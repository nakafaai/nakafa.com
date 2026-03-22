import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getProvisionalParams } from "@repo/backend/convex/irt/estimation";
import { IRT_OPERATIONAL_MODEL } from "@repo/backend/convex/irt/policy";
import {
  getLatestScaleVersionForTryout,
  getScaleVersionItems,
  type ScaleVersionItemSnapshot,
} from "@repo/backend/convex/irt/scales/read";
import {
  getPublishableScaleSnapshot,
  hasPublishedScaleChanged,
} from "@repo/backend/convex/irt/scales/snapshot";
import { ConvexError } from "convex/values";
import { getAll, getManyFrom } from "convex-helpers/server/relationships";

type IrtDbWriter = MutationCtx["db"];

/** Publishes one frozen scale version from a prepared item snapshot. */
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

  await Promise.all(
    items.map((item) =>
      db.insert("irtScaleVersionItems", {
        scaleVersionId,
        calibrationRunId: item.calibrationRunId,
        questionId: item.questionId,
        setId: item.setId,
        difficulty: item.difficulty,
        discrimination: item.discrimination,
      })
    )
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

/** Publishes an initial frozen scale version before enough calibration data exists. */
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

/** Returns an existing frozen scale version or publishes the appropriate next one. */
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

    if (latestScaleVersion.status === "official") {
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

/** Publishes a new official tryout scale if the current frozen version changed. */
export async function publishTryoutScaleVersionIfNeeded(
  ctx: MutationCtx,
  tryoutId: Id<"tryouts">
) {
  const tryout = await ctx.db.get("tryouts", tryoutId);

  if (!tryout) {
    throw new ConvexError({
      code: "IRT_TRYOUT_NOT_FOUND",
      message: "Tryout not found for scale publication.",
    });
  }

  const snapshot = await getPublishableScaleSnapshot(ctx.db, tryout._id);

  if (!snapshot) {
    return { kind: "not-ready" as const };
  }

  const latestScaleVersion = await getLatestScaleVersionForTryout(
    ctx.db,
    tryout._id
  );

  if (latestScaleVersion && latestScaleVersion.status === "official") {
    const latestScaleItems = await getScaleVersionItems(
      ctx.db,
      latestScaleVersion._id
    );

    if (
      !hasPublishedScaleChanged({
        publishedItems: latestScaleItems,
        snapshotItems: snapshot.items,
      })
    ) {
      return {
        kind: "unchanged" as const,
        scaleVersionId: latestScaleVersion._id,
      };
    }
  }

  const scaleVersionId = await publishScaleVersion(ctx.db, {
    tryoutId: tryout._id,
    questionCount: snapshot.questionCount,
    items: snapshot.items,
    status: "official",
    publishedAt: Date.now(),
  });

  await ctx.scheduler.runAfter(
    0,
    internal.tryouts.internalMutations.promoteProvisionalTryoutScores,
    {
      scaleVersionId,
      tryoutId: tryout._id,
    }
  );

  return { kind: "published" as const, scaleVersionId };
}

import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { IRT_OPERATIONAL_MODEL } from "@repo/backend/convex/irt/policy";
import { buildBootstrapScaleItems } from "@repo/backend/convex/irt/scales/bootstrap";
import {
  evaluateTryoutScaleQuality,
  upsertTryoutScaleQualityCheck,
} from "@repo/backend/convex/irt/scales/quality";
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

type IrtDbWriter = MutationCtx["db"];

/** Publishes one frozen scale version from a prepared item snapshot. */
async function publishScaleVersion(
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

/** Publishes an initial frozen scale version before enough calibration data exists. */
async function publishBootstrapScaleVersion(
  db: IrtDbWriter,
  {
    now,
    tryoutId,
  }: {
    now: number;
    tryoutId: Id<"tryouts">;
  }
) {
  const items = await buildBootstrapScaleItems(db, { now, tryoutId });

  if (!items) {
    return null;
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

async function publishOfficialScaleVersion(
  db: IrtDbWriter,
  {
    now,
    tryoutId,
    snapshot,
  }: {
    now: number;
    tryoutId: Id<"tryouts">;
    snapshot: NonNullable<
      Awaited<ReturnType<typeof getPublishableScaleSnapshot>>
    >;
  }
) {
  const scaleVersionId = await publishScaleVersion(db, {
    tryoutId,
    questionCount: snapshot.questionCount,
    items: snapshot.items,
    status: "official",
    publishedAt: now,
  });

  return db.get("irtScaleVersions", scaleVersionId);
}

async function getUnchangedOfficialScaleVersion(
  db: IrtDbWriter,
  {
    latestScaleVersion,
    snapshot,
  }: {
    latestScaleVersion: Awaited<
      ReturnType<typeof getLatestScaleVersionForTryout>
    >;
    snapshot: NonNullable<
      Awaited<ReturnType<typeof getPublishableScaleSnapshot>>
    >;
  }
) {
  if (!(latestScaleVersion && latestScaleVersion.status === "official")) {
    return null;
  }

  const latestScaleItems = await getScaleVersionItems(
    db,
    latestScaleVersion._id
  );

  if (
    hasPublishedScaleChanged({
      publishedItems: latestScaleItems,
      snapshotItems: snapshot.items,
    })
  ) {
    return null;
  }

  return latestScaleVersion;
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
  const scaleQuality = await evaluateTryoutScaleQuality(db, { now, tryoutId });

  if (scaleQuality) {
    await upsertTryoutScaleQualityCheck(db, scaleQuality);
  }

  const latestScaleVersion = await getLatestScaleVersionForTryout(db, tryoutId);

  if (!scaleQuality || scaleQuality.status === "blocked") {
    if (latestScaleVersion) {
      return latestScaleVersion;
    }

    return publishBootstrapScaleVersion(db, { now, tryoutId });
  }

  const publishableSnapshot = await getPublishableScaleSnapshot(db, tryoutId);

  if (latestScaleVersion) {
    if (!publishableSnapshot) {
      return latestScaleVersion;
    }

    const unchangedOfficialScale = await getUnchangedOfficialScaleVersion(db, {
      latestScaleVersion,
      snapshot: publishableSnapshot,
    });

    if (unchangedOfficialScale) {
      return unchangedOfficialScale;
    }

    return publishOfficialScaleVersion(db, {
      now,
      tryoutId,
      snapshot: publishableSnapshot,
    });
  }

  if (publishableSnapshot) {
    return publishOfficialScaleVersion(db, {
      now,
      tryoutId,
      snapshot: publishableSnapshot,
    });
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

  const scaleQuality = await evaluateTryoutScaleQuality(ctx.db, {
    now: Date.now(),
    tryoutId: tryout._id,
  });

  if (!scaleQuality) {
    return { kind: "not-ready" as const };
  }

  await upsertTryoutScaleQualityCheck(ctx.db, scaleQuality);

  if (scaleQuality.status === "blocked") {
    return { kind: "not-ready" as const };
  }

  const snapshot = await getPublishableScaleSnapshot(ctx.db, tryout._id);

  if (!snapshot) {
    return { kind: "not-ready" as const };
  }

  const latestScaleVersion = await getLatestScaleVersionForTryout(
    ctx.db,
    tryout._id
  );

  const unchangedOfficialScale = await getUnchangedOfficialScaleVersion(
    ctx.db,
    {
      latestScaleVersion,
      snapshot,
    }
  );

  if (unchangedOfficialScale) {
    return {
      kind: "unchanged" as const,
      scaleVersionId: unchangedOfficialScale._id,
    };
  }

  const scaleVersion = await publishOfficialScaleVersion(ctx.db, {
    now: Date.now(),
    tryoutId: tryout._id,
    snapshot,
  });

  if (!scaleVersion) {
    throw new ConvexError({
      code: "IRT_SCALE_VERSION_NOT_FOUND",
      message: "Published scale version could not be reloaded.",
    });
  }

  await ctx.scheduler.runAfter(
    0,
    internal.tryouts.internalMutations.promoteProvisionalTryoutScores,
    {
      scaleVersionId: scaleVersion._id,
      tryoutId: tryout._id,
    }
  );

  return { kind: "published" as const, scaleVersionId: scaleVersion._id };
}

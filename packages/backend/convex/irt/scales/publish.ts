import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { IRT_OPERATIONAL_MODEL } from "@repo/backend/convex/irt/policy";
import { evaluateTryoutScaleQuality } from "@repo/backend/convex/irt/scales/quality";
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
type LatestScaleVersion = Awaited<
  ReturnType<typeof getLatestScaleVersionForTryout>
>;
type ResolvedScaleVersion = NonNullable<LatestScaleVersion>;
type PublishableScaleSnapshot = NonNullable<
  Awaited<ReturnType<typeof getPublishableScaleSnapshot>>
>;

type OfficialScaleDecision =
  | { kind: "not-ready" }
  | {
      kind: "published" | "unchanged";
      scaleVersion: ResolvedScaleVersion;
    };

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
  if (items.length !== questionCount) {
    throw new ConvexError({
      code: "IRT_SCALE_ITEM_COUNT_MISMATCH",
      message:
        "Frozen scale item count does not match the scale version question count.",
    });
  }

  const questionIds = new Set(items.map((item) => item.questionId));

  if (questionIds.size !== items.length) {
    throw new ConvexError({
      code: "IRT_SCALE_ITEM_DUPLICATE_QUESTION",
      message: "Frozen scale items contain duplicate questions.",
    });
  }

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

async function publishOfficialScaleVersion(
  db: IrtDbWriter,
  {
    now,
    tryoutId,
    snapshot,
  }: {
    now: number;
    tryoutId: Id<"tryouts">;
    snapshot: PublishableScaleSnapshot;
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
    latestScaleVersion: LatestScaleVersion;
    snapshot: PublishableScaleSnapshot;
  }
) {
  if (!(latestScaleVersion && latestScaleVersion.status === "official")) {
    return null;
  }

  const latestScaleItems = await getScaleVersionItems(db, latestScaleVersion);

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

async function resolveOfficialScaleDecision(
  db: IrtDbWriter,
  {
    latestScaleVersion,
    now,
    tryoutId,
  }: {
    latestScaleVersion: LatestScaleVersion;
    now: number;
    tryoutId: Id<"tryouts">;
  }
): Promise<OfficialScaleDecision> {
  const snapshot = await getPublishableScaleSnapshot(db, tryoutId);

  if (!snapshot) {
    return { kind: "not-ready" };
  }

  const unchangedOfficialScale = await getUnchangedOfficialScaleVersion(db, {
    latestScaleVersion,
    snapshot,
  });

  if (unchangedOfficialScale) {
    return {
      kind: "unchanged",
      scaleVersion: unchangedOfficialScale,
    };
  }

  const scaleVersion = await publishOfficialScaleVersion(db, {
    now,
    tryoutId,
    snapshot,
  });

  if (!scaleVersion) {
    throw new ConvexError({
      code: "IRT_SCALE_VERSION_NOT_FOUND",
      message: "Published scale version could not be reloaded.",
    });
  }

  return {
    kind: "published",
    scaleVersion,
  };
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

  const now = Date.now();

  const scaleQuality = await evaluateTryoutScaleQuality(ctx.db, {
    now,
    tryoutId: tryout._id,
  });

  if (!scaleQuality) {
    return { kind: "not-ready" as const };
  }

  if (scaleQuality.status === "blocked") {
    return { kind: "not-ready" as const };
  }

  const latestScaleVersion = await getLatestScaleVersionForTryout(
    ctx.db,
    tryout._id
  );

  const officialScaleDecision = await resolveOfficialScaleDecision(ctx.db, {
    latestScaleVersion,
    now,
    tryoutId: tryout._id,
  });

  if (officialScaleDecision.kind === "not-ready") {
    return { kind: "not-ready" as const };
  }

  if (officialScaleDecision.kind === "unchanged") {
    return {
      kind: "unchanged" as const,
      scaleVersionId: officialScaleDecision.scaleVersion._id,
    };
  }

  const scaleVersion = officialScaleDecision.scaleVersion;

  await ctx.scheduler.runAfter(
    0,
    internal.tryouts.mutations.internal.scoring.promoteProvisionalTryoutScores,
    {
      scaleVersionId: scaleVersion._id,
      tryoutId: tryout._id,
    }
  );

  return { kind: "published" as const, scaleVersionId: scaleVersion._id };
}

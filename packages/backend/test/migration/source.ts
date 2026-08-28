import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  CLEANUP_ORPHAN_ARTIFACT,
  CLEANUP_SHARED_ARTIFACT,
  CLEANUP_SOURCE_INVENTORY,
  CLEANUP_SOURCE_SNAPSHOT,
  type CleanupSourceInventory,
} from "@repo/backend/test/migration/state";
import type { CleanupTarget } from "@repo/backend/test/migration/target";

/** Creates one retained source scale represented by the fixture placement. */
export async function seedSourceScale(ctx: MutationCtx) {
  const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
    model: "2pl",
    publishedAt: 1,
    questionCount: 1,
    setIdentity: "source-set",
    status: "official",
    tryoutSnapshotId: CLEANUP_SOURCE_SNAPSHOT,
  });
  const runId = await ctx.db.insert("irtCalibrationRuns", {
    attemptCount: 1,
    completedAt: 1,
    iterationCount: 1,
    maxParameterDelta: 0,
    model: "2pl",
    questionCount: 1,
    responseCount: 1,
    scaleVersionId,
    sectionIdentity: "source-section",
    startedAt: 1,
    status: "completed",
    updatedAt: 1,
  });
  await ctx.db.insert("irtScaleItems", {
    calibrationRunId: runId,
    calibrationStatus: "calibrated",
    correctRate: 0.5,
    difficulty: 0,
    discrimination: 1,
    placementIdentity: "source-placement",
    placementRowHash: "source-placement",
    responseCount: 1,
    scaleVersionId,
  });
  return { runId, scaleVersionId };
}

/** Seeds every legacy source row removed only after signed completion. */
export async function seedSourceRows(
  ctx: MutationCtx,
  target: CleanupTarget,
  sourceInventory: CleanupSourceInventory = CLEANUP_SOURCE_INVENTORY
) {
  await ctx.db.insert("contentSnapshots", {
    createdAt: 1,
    family: "tryout",
    retainUntil: Number.MAX_SAFE_INTEGER,
    snapshotId: CLEANUP_SOURCE_SNAPSHOT,
    snapshotJson: "{}",
  });
  await Promise.all(
    Array.from({ length: sourceInventory.catalogRowCount }, (_, index) =>
      ctx.db.insert("tryoutHistoryRows", {
        index,
        rowHash: `source-history-${index}`,
        rowJson: "{}",
        rowKind: "catalog",
        snapshotId: CLEANUP_SOURCE_SNAPSHOT,
      })
    )
  );
  await Promise.all(
    Array.from({ length: sourceInventory.placementRowCount }, (_, index) =>
      ctx.db.insert("tryoutHistoryRows", {
        answerArtifactHash: CLEANUP_ORPHAN_ARTIFACT,
        index: sourceInventory.catalogRowCount + index,
        questionArtifactHash: CLEANUP_SHARED_ARTIFACT,
        rowHash: `source-placement-${index}`,
        rowJson: "{}",
        rowKind: "placement",
        snapshotId: CLEANUP_SOURCE_SNAPSHOT,
      })
    )
  );
  await Promise.all(
    Array.from({ length: sourceInventory.catalogRowCount }, (_, index) =>
      ctx.db.insert("tryoutCatalog", {
        appLocale: "id",
        assetId: `source-catalog-${index}`,
        identity: `source-catalog-${index}`,
        index,
        kind: "set",
        order: index,
        rowHash: `source-catalog-${index}`,
        rowJson: "{}",
        snapshotId: CLEANUP_SOURCE_SNAPSHOT,
      })
    )
  );
  await Promise.all(
    Array.from({ length: sourceInventory.placementRowCount }, (_, index) =>
      ctx.db.insert("tryoutPlacements", {
        answerArtifactHash: CLEANUP_ORPHAN_ARTIFACT,
        answerArtifactLocale: "id",
        appLocale: "id",
        contentHash: `source-content-${index}`,
        countryKey: "indonesia",
        deliveryLanguage: "id",
        examKey: "snbt",
        identity: `source-placement-${index}`,
        index: index + 1,
        questionArtifactHash: CLEANUP_SHARED_ARTIFACT,
        questionArtifactLocale: "id",
        questionOrder: index + 1,
        rowHash: `source-placement-${index}`,
        rowJson: "{}",
        sectionKey: "section-1",
        setKey: "set-1",
        snapshotId: CLEANUP_SOURCE_SNAPSHOT,
        trackKey: "2027",
      })
    )
  );
  await ctx.db.insert("tryoutBundles", {
    createdAt: 1,
    index: 0,
    manifestHash: "source-manifest",
    releaseId: "source-release",
    releaseJson: "{}",
    rendererJson: "{}",
    snapshotId: CLEANUP_SOURCE_SNAPSHOT,
  });
  await ctx.db.insert("tryoutRuntimeBundles", {
    bundleHash: "source-bundle",
    bundleJson: "{}",
    cleanupReleaseId: "source-release",
    createdAt: 1,
    rendererJson: "{}",
    rendererManifestHash: "source-renderer",
    snapshotId: CLEANUP_SOURCE_SNAPSHOT,
    sourceGitSha: "source-git",
    sourceManifestHash: "source-manifest",
    sourceReleaseId: "source-release",
  });
  await ctx.db.insert("contentArtifacts", {
    artifactHash: CLEANUP_SHARED_ARTIFACT,
    artifactJson: "{}",
    createdAt: 1,
    retainUntil: Number.MAX_SAFE_INTEGER,
  });
  await ctx.db.insert("contentArtifacts", {
    artifactHash: CLEANUP_ORPHAN_ARTIFACT,
    artifactJson: "{}",
    createdAt: 1,
    retainUntil: Number.MAX_SAFE_INTEGER,
  });
  await ctx.db.patch(target.placement._id, {
    questionArtifactHash: CLEANUP_SHARED_ARTIFACT,
  });
}

/** Seeds one permanent target scale used to prove cleanup isolation. */
export async function seedTargetScale(
  ctx: MutationCtx,
  snapshotId: string,
  placementRowHash: string
) {
  const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
    history: true,
    model: "2pl",
    publishedAt: 1,
    questionCount: 1,
    setIdentity: "source-set",
    status: "official",
    tryoutSnapshotId: snapshotId,
  });
  const runId = await ctx.db.insert("irtCalibrationRuns", {
    attemptCount: 1,
    completedAt: 1,
    iterationCount: 1,
    maxParameterDelta: 0,
    model: "2pl",
    questionCount: 1,
    responseCount: 1,
    scaleVersionId,
    sectionIdentity: "source-section",
    startedAt: 1,
    status: "completed",
    updatedAt: 1,
  });
  await ctx.db.insert("irtScaleItems", {
    calibrationRunId: runId,
    calibrationStatus: "calibrated",
    correctRate: 0.5,
    difficulty: 0,
    discrimination: 1,
    placementIdentity: "source-placement",
    placementRowHash,
    responseCount: 1,
    scaleVersionId,
  });
  return { runId, scaleVersionId };
}

export type SourceScale = Awaited<ReturnType<typeof seedSourceScale>>;
export interface TargetScale {
  readonly runId: Id<"irtCalibrationRuns">;
  readonly scaleVersionId: Id<"irtScaleVersions">;
}

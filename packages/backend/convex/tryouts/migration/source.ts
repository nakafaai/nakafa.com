import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import { readTryoutHistoryAttemptInventory } from "@repo/backend/convex/tryouts/migration/attempt/inventory";
import { readTryoutHistoryScaleInventory } from "@repo/backend/convex/tryouts/migration/scale/inventory";
import { v } from "convex/values";
import { Effect } from "effect";

export const scaleInventoryValidator = v.object({
  count: v.number(),
  inventoryJson: v.string(),
  itemCount: v.number(),
  runCount: v.number(),
  scaleVersionIds: v.array(v.id("irtScaleVersions")),
});
export const attemptInventoryValidator = v.object({
  attemptCount: v.number(),
  frozenPlacementCount: v.number(),
  inventoryJson: v.string(),
  progressCount: v.number(),
  responseCount: v.number(),
  scoreCount: v.number(),
  sectionAttemptCount: v.number(),
});
export const sourceBytesValidator = v.object({
  artifactCount: v.number(),
  catalogRowCount: v.number(),
  legacyBundleCount: v.number(),
  placementRowCount: v.number(),
  releases: v.array(
    v.object({
      attemptCount: v.number(),
      releaseId: v.string(),
      releaseJson: v.string(),
    })
  ),
  rendererJson: v.string(),
  runtimeBundleCount: v.number(),
  snapshotJson: v.string(),
});

/** Reads immutable historical release, renderer, snapshot, and row counts. */
const readSourceBytes = Effect.fn("tryouts.migration.readSourceBytes")(
  function* (ctx: QueryCtx) {
    const { legacyBundles, runtimeBundles, snapshot } = yield* Effect.all({
      legacyBundles: Effect.promise(() =>
        ctx.db
          .query("tryoutBundles")
          .withIndex("by_snapshotId_and_index", (query) =>
            query.eq("snapshotId", retainedTryoutHistoryPlan.snapshotId)
          )
          .take(retainedTryoutHistoryPlan.legacyBundleCount + 1)
      ),
      runtimeBundles: Effect.promise(() =>
        ctx.db
          .query("tryoutRuntimeBundles")
          .withIndex("by_snapshotId_and_rendererManifestHash", (query) =>
            query.eq("snapshotId", retainedTryoutHistoryPlan.snapshotId)
          )
          .take(retainedTryoutHistoryPlan.runtimeBundleCount + 1)
      ),
      snapshot: Effect.promise(() =>
        ctx.db
          .query("contentSnapshots")
          .withIndex("by_family_and_snapshotId", (query) =>
            query
              .eq("family", "tryout")
              .eq("snapshotId", retainedTryoutHistoryPlan.snapshotId)
          )
          .unique()
      ),
    });
    if (!snapshot) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        "Retained try-out snapshot is missing."
      );
    }
    if (
      legacyBundles.length !== retainedTryoutHistoryPlan.legacyBundleCount ||
      runtimeBundles.length !== retainedTryoutHistoryPlan.runtimeBundleCount
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Retained try-out bundle counts changed after their audit."
      );
    }
    const rows = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryRows")
        .withIndex("by_snapshotId_and_rowKind_and_index", (query) =>
          query.eq("snapshotId", retainedTryoutHistoryPlan.snapshotId)
        )
        .take(
          retainedTryoutHistoryPlan.catalogRowCount +
            retainedTryoutHistoryPlan.placementRowCount +
            1
        )
    );
    const artifactHashes = new Set<string>();
    for (const row of rows) {
      if (row.rowKind === "placement") {
        artifactHashes.add(row.answerArtifactHash);
        artifactHashes.add(row.questionArtifactHash);
      }
    }
    const releases: {
      attemptCount: number;
      releaseId: string;
      releaseJson: string;
    }[] = [];
    let rendererJson: string | undefined;
    for (const expected of retainedTryoutHistoryPlan.releases) {
      const bundle = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutBundles")
          .withIndex("by_releaseId", (query) =>
            query.eq("releaseId", expected.releaseId)
          )
          .unique()
      );
      if (!bundle) {
        return yield* releaseFail(
          "CONTENT_RELEASE_MISSING",
          `Retained try-out release ${expected.releaseId} is missing.`
        );
      }
      if (rendererJson !== undefined && rendererJson !== bundle.rendererJson) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Retained releases disagree on renderer bytes."
        );
      }
      rendererJson = bundle.rendererJson;
      releases.push({
        attemptCount: expected.attemptCount,
        releaseId: expected.releaseId,
        releaseJson: bundle.releaseJson,
      });
    }
    if (rendererJson === undefined) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        "Retained renderer is missing."
      );
    }
    return {
      artifactCount: artifactHashes.size,
      catalogRowCount: rows.filter(({ rowKind }) => rowKind === "catalog")
        .length,
      legacyBundleCount: legacyBundles.length,
      placementRowCount: rows.filter(({ rowKind }) => rowKind === "placement")
        .length,
      releases,
      rendererJson,
      runtimeBundleCount: runtimeBundles.length,
      snapshotJson: snapshot.snapshotJson,
    };
  }
);

export const attemptInventory = internalQuery({
  args: {},
  returns: attemptInventoryValidator,
  handler: (ctx) =>
    runConvexProgram(
      readTryoutHistoryAttemptInventory(ctx).pipe(
        Effect.map(
          ({
            attemptCount,
            frozenPlacementCount,
            inventoryJson,
            progressCount,
            responseCount,
            scoreCount,
            sectionAttemptCount,
          }) => ({
            attemptCount,
            frozenPlacementCount,
            inventoryJson,
            progressCount,
            responseCount,
            scoreCount,
            sectionAttemptCount,
          })
        )
      )
    ),
});

export const scaleInventory = internalQuery({
  args: {},
  returns: scaleInventoryValidator,
  handler: (ctx) =>
    runConvexProgram(
      readTryoutHistoryScaleInventory(ctx).pipe(
        Effect.map(
          ({ count, inventoryJson, itemCount, runCount, scaleVersionIds }) => ({
            count,
            inventoryJson,
            itemCount,
            runCount,
            scaleVersionIds,
          })
        )
      )
    ),
});

export const sourceBytes = internalQuery({
  args: {},
  returns: sourceBytesValidator,
  handler: (ctx) => runConvexProgram(readSourceBytes(ctx)),
});

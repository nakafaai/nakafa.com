import { decodeStoredRelease } from "@nakafa/aksara-contracts/history/decode";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  RETAINED_TRYOUT_ATTEMPT_COUNT,
  RETAINED_TRYOUT_PROGRESS_COUNT,
  RETAINED_TRYOUT_RELEASE_COUNTS,
  RETAINED_TRYOUT_SNAPSHOT_ID,
} from "@repo/backend/convex/tryouts/history/cutover/constants";
import {
  RETAINED_TRYOUT_CATALOG_ROW_COUNT,
  RETAINED_TRYOUT_PLACEMENT_ROW_COUNT,
  verifyStoredTryoutHistory,
} from "@repo/backend/convex/tryouts/history/rows";
import { findTryoutBundleByRelease } from "@repo/backend/convex/tryouts/runtime/bundle";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import { v } from "convex/values";
import { Effect } from "effect";

const cutoverProofValidator = v.object({
  attempts: v.number(),
  catalogHistory: v.number(),
  catalogSource: v.number(),
  markers: v.number(),
  placementHistory: v.number(),
  placementSource: v.number(),
  progress: v.number(),
  releases: v.number(),
  snapshotId: v.string(),
});

/** Proves every exact production cutover invariant without exposing old bytes. */
export const proof = internalQuery({
  args: {},
  returns: cutoverProofValidator,
  handler: (ctx) => runConvexProgram(readCutoverProof(ctx)),
});

/** Reads bounded inventories and hard-fails on any audit deviation. */
const readCutoverProof = Effect.fn("tryouts.history.cutover.readProof")(
  function* (ctx: QueryCtx) {
    const [attempts, catalogSource, markers, placementSource, progress] =
      yield* Effect.all([
        cutoverPromise("Unable to read retained attempts.", () =>
          ctx.db
            .query("tryoutAttempts")
            .withIndex("by_tryoutSnapshotId", (index) =>
              index.eq("tryoutSnapshotId", RETAINED_TRYOUT_SNAPSHOT_ID)
            )
            .take(RETAINED_TRYOUT_ATTEMPT_COUNT + 1)
        ),
        cutoverPromise("Unable to read historical catalog source.", () =>
          ctx.db
            .query("tryoutCatalog")
            .withIndex("by_snapshotId_and_index", (index) =>
              index.eq("snapshotId", RETAINED_TRYOUT_SNAPSHOT_ID)
            )
            .take(1)
        ),
        cutoverPromise("Unable to read retained markers.", () =>
          ctx.db
            .query("tryoutAttemptHistory")
            .take(RETAINED_TRYOUT_ATTEMPT_COUNT + 1)
        ),
        cutoverPromise("Unable to read historical placement source.", () =>
          ctx.db
            .query("tryoutPlacements")
            .withIndex("by_snapshotId_and_index", (index) =>
              index.eq("snapshotId", RETAINED_TRYOUT_SNAPSHOT_ID)
            )
            .take(1)
        ),
        cutoverPromise("Unable to read compact progress.", () =>
          ctx.db
            .query("tryoutSetProgress")
            .take(RETAINED_TRYOUT_PROGRESS_COUNT + 1)
        ),
      ]);
    if (
      attempts.length !== RETAINED_TRYOUT_ATTEMPT_COUNT ||
      markers.length !== RETAINED_TRYOUT_ATTEMPT_COUNT ||
      progress.length !== RETAINED_TRYOUT_PROGRESS_COUNT ||
      catalogSource.length !== 0 ||
      placementSource.length !== 0
    ) {
      return yield* cutoverIntegrity(
        "Try-out cutover inventory differs from the exact production audit."
      );
    }
    const attemptsById = new Map(
      attempts.map((attempt) => [attempt._id, attempt])
    );
    for (const attempt of attempts) {
      if (attempt.appLocale === undefined || attempt.locale !== undefined) {
        return yield* cutoverIntegrity(
          "Retained attempt has not completed the appLocale cutover."
        );
      }
    }
    for (const row of progress) {
      const attempt = attemptsById.get(row.latestAttemptId);
      if (
        !attempt ||
        row.appLocale !== attempt.appLocale ||
        row.locale !== undefined
      ) {
        return yield* cutoverIntegrity(
          "Try-out progress has not completed the appLocale cutover."
        );
      }
    }
    for (const marker of markers) {
      const attempt = attemptsById.get(marker.tryoutAttemptId);
      if (
        !attempt ||
        marker.tryoutSnapshotId !== attempt.tryoutSnapshotId ||
        marker.snapshotReleaseId !== attempt.snapshotReleaseId
      ) {
        return yield* cutoverIntegrity(
          "Retained marker differs from its audited attempt."
        );
      }
    }
    let expectedSnapshotId: string | undefined;
    let releases = 0;
    for (const [releaseId, expectedCount] of Object.entries(
      RETAINED_TRYOUT_RELEASE_COUNTS
    )) {
      if (
        attempts.filter((attempt) => attempt.snapshotReleaseId === releaseId)
          .length !== expectedCount
      ) {
        return yield* cutoverIntegrity(
          `Retained release ${releaseId} count differs from the audit.`
        );
      }
      const bundle = yield* findTryoutBundleByRelease(ctx, releaseId).pipe(
        Effect.mapError((cause) =>
          cutoverIntegrity(
            `Unable to read retained bundle ${releaseId}.`,
            cause
          )
        )
      );
      if (!bundle) {
        return yield* cutoverIntegrity(
          `Retained bundle ${releaseId} is unavailable.`
        );
      }
      const input = yield* parseJson(bundle.releaseJson, releaseId);
      const release = yield* decodeStoredRelease(input).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        ),
        Effect.mapError((cause) =>
          cutoverIntegrity(
            `Retained release ${releaseId} failed authentication.`,
            cause
          )
        )
      );
      const releaseSnapshotId =
        release.manifest.snapshots.tryout.resultSnapshotId;
      if (
        bundle.snapshotId !== RETAINED_TRYOUT_SNAPSHOT_ID ||
        release.manifest.releaseId !== releaseId ||
        release.manifestHash !== bundle.manifestHash ||
        releaseSnapshotId !== RETAINED_TRYOUT_SNAPSHOT_ID
      ) {
        return yield* cutoverIntegrity(
          `Retained release ${releaseId} differs from its bundle.`
        );
      }
      if (
        expectedSnapshotId !== undefined &&
        expectedSnapshotId !== releaseSnapshotId
      ) {
        return yield* cutoverIntegrity(
          "Retained releases select different try-out snapshots."
        );
      }
      expectedSnapshotId = releaseSnapshotId;
      releases += 1;
    }
    if (expectedSnapshotId === undefined) {
      return yield* cutoverIntegrity(
        "Retained releases do not select a try-out snapshot."
      );
    }
    const inventory = yield* verifyStoredTryoutHistory(ctx, expectedSnapshotId);
    if (
      inventory.catalog.length !== RETAINED_TRYOUT_CATALOG_ROW_COUNT ||
      inventory.placements.length !== RETAINED_TRYOUT_PLACEMENT_ROW_COUNT
    ) {
      return yield* cutoverIntegrity(
        "Authenticated history differs from the production audit."
      );
    }
    return {
      attempts: attempts.length,
      catalogHistory: inventory.catalog.length,
      catalogSource: catalogSource.length,
      markers: markers.length,
      placementHistory: inventory.placements.length,
      placementSource: placementSource.length,
      progress: progress.length,
      releases,
      snapshotId: RETAINED_TRYOUT_SNAPSHOT_ID,
    };
  }
);

/** Parses one signed release without exposing old bytes. */
function parseJson(source: string, releaseId: string) {
  return Effect.try({
    catch: (cause) =>
      cutoverIntegrity(`Retained release ${releaseId} is invalid JSON.`, cause),
    try: (): unknown => JSON.parse(source),
  });
}

/** Creates one stable fail-closed cutover integrity error. */
function cutoverIntegrity(message: string, cause?: unknown) {
  return new TryoutRuntimeError({
    cause,
    code: "TRYOUT_HISTORY_CUTOVER_INTEGRITY",
    message,
  });
}

/** Lifts one bounded database operation into the cutover error channel. */
function cutoverPromise<A>(message: string, operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (cause) => cutoverIntegrity(message, cause),
    try: operation,
  });
}

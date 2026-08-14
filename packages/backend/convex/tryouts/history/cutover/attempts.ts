import { decodeStoredRelease } from "@nakafa/aksara-contracts/history/decode";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  RETAINED_TRYOUT_ATTEMPT_COUNT,
  RETAINED_TRYOUT_RELEASE_COUNTS,
  RETAINED_TRYOUT_SNAPSHOT_ID,
  TRYOUT_HISTORY_CUTOVER_BATCH_SIZE,
} from "@repo/backend/convex/tryouts/history/cutover/constants";
import { loadStoredTryoutSnapshot } from "@repo/backend/convex/tryouts/history/rows";
import { findTryoutBundleByRelease } from "@repo/backend/convex/tryouts/runtime/bundle";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import { v } from "convex/values";
import { Effect } from "effect";

const attemptCutoverResultValidator = v.object({
  attempts: v.number(),
  changed: v.number(),
  complete: v.boolean(),
  markers: v.number(),
});

const legacyLocaleRemovalResultValidator = v.object({
  changed: v.number(),
  complete: v.boolean(),
  remaining: v.number(),
});

/** Migrates the exact 21 retained attempts and creates immutable markers. */
export const migrate = internalMutation({
  args: {},
  returns: attemptCutoverResultValidator,
  handler: (ctx) => runConvexProgram(migrateRetainedAttempts(ctx)),
});

/** Removes attempt locale only after appLocale and all markers are proven. */
export const removeLegacyLocale = internalMutation({
  args: {},
  returns: legacyLocaleRemovalResultValidator,
  handler: (ctx) => runConvexProgram(removeRetainedAttemptLocales(ctx)),
});

/** Authenticates exact bundles before marking any attempt as historical. */
const authenticateRetainedBundles = Effect.fn(
  "tryouts.history.cutover.authenticateRetainedBundles"
)(function* (ctx: MutationCtx) {
  yield* loadStoredTryoutSnapshot(ctx, RETAINED_TRYOUT_SNAPSHOT_ID);
  for (const releaseId of Object.keys(RETAINED_TRYOUT_RELEASE_COUNTS)) {
    const bundle = yield* findTryoutBundleByRelease(ctx, releaseId).pipe(
      Effect.mapError((cause) =>
        cutoverIntegrity(
          `Unable to read retained try-out bundle ${releaseId}.`,
          cause
        )
      )
    );
    if (!bundle || bundle.snapshotId !== RETAINED_TRYOUT_SNAPSHOT_ID) {
      return yield* cutoverIntegrity(
        `Retained try-out bundle ${releaseId} changed its snapshot identity.`
      );
    }
    const input = yield* parseReleaseJson(bundle.releaseJson, releaseId);
    const release = yield* decodeStoredRelease(input).pipe(
      Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver),
      Effect.mapError((cause) =>
        cutoverIntegrity(
          `Retained try-out release ${releaseId} failed authentication.`,
          cause
        )
      )
    );
    if (
      release.manifest.releaseId !== releaseId ||
      release.manifestHash !== bundle.manifestHash ||
      release.manifest.snapshots.tryout.resultSnapshotId !==
        RETAINED_TRYOUT_SNAPSHOT_ID
    ) {
      return yield* cutoverIntegrity(
        `Retained try-out release ${releaseId} differs from its bundle.`
      );
    }
  }
});

/** Populates appLocale and one exact storage-history discriminator per attempt. */
const migrateRetainedAttempts = Effect.fn(
  "tryouts.history.cutover.migrateRetainedAttempts"
)(function* (ctx: MutationCtx) {
  yield* authenticateRetainedBundles(ctx);
  const attempts = yield* readRetainedAttempts(ctx);
  yield* assertRetainedAttemptInventory(attempts);
  let changed = 0;
  for (const attempt of attempts) {
    const appLocale = yield* resolveMigrationLocale(attempt);
    if (attempt.appLocale === undefined) {
      yield* cutoverPromise(
        "Unable to migrate retained attempt appLocale.",
        () => ctx.db.patch("tryoutAttempts", attempt._id, { appLocale })
      );
      changed += 1;
    }
    const marker = yield* cutoverPromise(
      "Unable to read retained attempt history marker.",
      () =>
        ctx.db
          .query("tryoutAttemptHistory")
          .withIndex("by_tryoutAttemptId", (index) =>
            index.eq("tryoutAttemptId", attempt._id)
          )
          .unique()
    );
    if (marker) {
      if (
        marker.tryoutSnapshotId !== RETAINED_TRYOUT_SNAPSHOT_ID ||
        marker.snapshotReleaseId !== attempt.snapshotReleaseId
      ) {
        return yield* cutoverIntegrity(
          "Retained attempt history marker differs from its owner."
        );
      }
      continue;
    }
    yield* cutoverPromise("Unable to insert retained attempt marker.", () =>
      ctx.db.insert("tryoutAttemptHistory", {
        snapshotReleaseId: attempt.snapshotReleaseId,
        tryoutAttemptId: attempt._id,
        tryoutSnapshotId: RETAINED_TRYOUT_SNAPSHOT_ID,
      })
    );
    changed += 1;
  }
  const markers = yield* readAttemptMarkers(ctx);
  yield* assertMarkerInventory(markers, attempts);
  return {
    attempts: attempts.length,
    changed,
    complete: true,
    markers: markers.length,
  };
});

/** Removes the bounded legacy field after exact marker ownership is complete. */
const removeRetainedAttemptLocales = Effect.fn(
  "tryouts.history.cutover.removeRetainedAttemptLocales"
)(function* (ctx: MutationCtx) {
  const attempts = yield* readRetainedAttempts(ctx);
  yield* assertRetainedAttemptInventory(attempts);
  const markers = yield* readAttemptMarkers(ctx);
  yield* assertMarkerInventory(markers, attempts);
  const pending = attempts
    .filter(({ locale }) => locale !== undefined)
    .slice(0, TRYOUT_HISTORY_CUTOVER_BATCH_SIZE);
  for (const attempt of pending) {
    yield* resolveMigrationLocale(attempt);
    yield* cutoverPromise("Unable to remove retained attempt locale.", () =>
      ctx.db.patch("tryoutAttempts", attempt._id, { locale: undefined })
    );
  }
  const remaining =
    attempts.filter(({ locale }) => locale !== undefined).length -
    pending.length;
  return {
    changed: pending.length,
    complete: remaining === 0,
    remaining,
  };
});

/** Loads exactly the production attempts that own the old snapshot. */
function readRetainedAttempts(ctx: MutationCtx) {
  return cutoverPromise("Unable to read retained try-out attempts.", () =>
    ctx.db
      .query("tryoutAttempts")
      .withIndex("by_tryoutSnapshotId", (index) =>
        index.eq("tryoutSnapshotId", RETAINED_TRYOUT_SNAPSHOT_ID)
      )
      .take(RETAINED_TRYOUT_ATTEMPT_COUNT + 1)
  );
}

/** Loads the complete bounded marker inventory without an open-ended scan. */
function readAttemptMarkers(ctx: MutationCtx) {
  return cutoverPromise("Unable to read retained attempt markers.", () =>
    ctx.db.query("tryoutAttemptHistory").take(RETAINED_TRYOUT_ATTEMPT_COUNT + 1)
  );
}

/** Proves exact snapshot, release split, and locale source for all attempts. */
const assertRetainedAttemptInventory = Effect.fn(
  "tryouts.history.cutover.assertRetainedAttemptInventory"
)(function* (attempts: readonly Doc<"tryoutAttempts">[]) {
  if (attempts.length !== RETAINED_TRYOUT_ATTEMPT_COUNT) {
    return yield* cutoverIntegrity(
      "Retained try-out attempt count differs from the production audit."
    );
  }
  for (const [releaseId, expectedCount] of Object.entries(
    RETAINED_TRYOUT_RELEASE_COUNTS
  )) {
    const count = attempts.filter(
      (attempt) => attempt.snapshotReleaseId === releaseId
    ).length;
    if (count !== expectedCount) {
      return yield* cutoverIntegrity(
        `Retained release ${releaseId} attempt count differs from the production audit.`
      );
    }
  }
  const knownReleaseCount = attempts.filter((attempt) =>
    Object.hasOwn(RETAINED_TRYOUT_RELEASE_COUNTS, attempt.snapshotReleaseId)
  ).length;
  if (knownReleaseCount !== attempts.length) {
    return yield* cutoverIntegrity(
      "Retained try-out attempts reference an unaudited release."
    );
  }
  yield* Effect.forEach(attempts, resolveMigrationLocale, { discard: true });
});

/** Proves every marker matches one exact retained attempt and no other row. */
const assertMarkerInventory = Effect.fn(
  "tryouts.history.cutover.assertMarkerInventory"
)(function* (
  markers: readonly Doc<"tryoutAttemptHistory">[],
  attempts: readonly Doc<"tryoutAttempts">[]
) {
  if (markers.length !== RETAINED_TRYOUT_ATTEMPT_COUNT) {
    return yield* cutoverIntegrity(
      "Retained try-out marker count differs from the production audit."
    );
  }
  const attemptsById = new Map(
    attempts.map((attempt) => [attempt._id, attempt])
  );
  for (const marker of markers) {
    const attempt = attemptsById.get(marker.tryoutAttemptId);
    if (
      !attempt ||
      marker.tryoutSnapshotId !== attempt.tryoutSnapshotId ||
      marker.snapshotReleaseId !== attempt.snapshotReleaseId
    ) {
      return yield* cutoverIntegrity(
        "Retained try-out marker inventory contains an unaudited reference."
      );
    }
  }
});

/** Resolves the one temporary legacy value without business-read fallback. */
function resolveMigrationLocale(attempt: Doc<"tryoutAttempts">) {
  const appLocale = attempt.appLocale;
  const legacyLocale = attempt.locale;
  if (appLocale && legacyLocale && appLocale !== legacyLocale) {
    return Effect.fail(
      cutoverIntegrity("Retained attempt locale fields disagree.")
    );
  }
  const resolved = appLocale ?? legacyLocale;
  if (!resolved || resolved === "de") {
    return Effect.fail(
      cutoverIntegrity("Retained attempt has no audited historical app locale.")
    );
  }
  return Effect.succeed(resolved);
}

/** Parses one retained release without exposing its immutable bytes. */
function parseReleaseJson(source: string, releaseId: string) {
  return Effect.try({
    catch: (cause) =>
      cutoverIntegrity(
        `Retained try-out release ${releaseId} is not valid JSON.`,
        cause
      ),
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

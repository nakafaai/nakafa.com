import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  loadRelease,
  loadState,
} from "@repo/backend/confect/contentRelease/model";
import { loadTryoutRuntimeBundle } from "@repo/backend/confect/tryouts/runtime/signed";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, Option, Schema } from "effect";

const RuntimeRetentionOptionsSchema = Schema.Struct({
  ignoredReleaseId: Schema.optionalKey(Schema.String),
});
type RuntimeRetentionOptions = typeof RuntimeRetentionOptionsSchema.Type;

/** Checks whether one release still selects an immutable try-out pair. */
const releaseRetainsRuntime = Effect.fn(
  "contentRelease.releaseRetainsTryoutRuntime"
)(function* (releaseId: string, row: Docs["tryoutRuntimeBundles"]) {
  const release = yield* loadRelease(releaseId);
  const { originKind, rendererManifestHash, snapshotTransitions } = release;
  const transition = snapshotTransitions.tryout;
  if (rendererManifestHash !== row.rendererManifestHash) {
    return false;
  }
  if (transition.resultSnapshotId === row.snapshotId) {
    return true;
  }
  return (
    originKind === "git" &&
    transition.mode === "replace" &&
    transition.baseSnapshotId === row.snapshotId
  );
});

/** Classifies every attempt and release consumer of one pair. */
export const readTryoutRuntimeRetention = Effect.fn(
  "contentRelease.readTryoutRuntimeRetention"
)(function* (
  row: Docs["tryoutRuntimeBundles"],
  options?: RuntimeRetentionOptions
) {
  const database = yield* DatabaseReader;
  const [attempt, state] = yield* Effect.all([
    database
      .table("tryoutAttempts")
      .index("by_tryoutBundleId", (query) =>
        query.eq("tryoutBundleId", row._id)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie),
    loadState(),
  ]);
  const releaseIds = state
    ? [state.activeReleaseId, state.candidateReleaseId, state.recoveryReleaseId]
    : [];
  for (const releaseId of releaseIds) {
    if (
      releaseId &&
      releaseId !== options?.ignoredReleaseId &&
      (yield* releaseRetainsRuntime(releaseId, row))
    ) {
      return {
        retainedByAttempt: attempt !== null,
        retainingReleaseId: releaseId,
      };
    }
  }
  return {
    retainedByAttempt: attempt !== null,
    retainingReleaseId: null,
  };
});

/** Reconciles permanent ownership after its attempt is deleted transactionally. */
export const reconcileTryoutRuntimeAfterAttempt = Effect.fn(
  "contentRelease.reconcileTryoutRuntimeAfterAttempt"
)(function* (runtimeId: Id<"tryoutRuntimeBundles">) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const row = yield* database
    .table("tryoutRuntimeBundles")
    .get(runtimeId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (!row) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "A deleted try-out attempt referenced a missing permanent runtime."
    );
  }
  const retention = yield* readTryoutRuntimeRetention(row);
  const cleanupReleaseId = retention.retainingReleaseId;
  if (cleanupReleaseId) {
    if (cleanupReleaseId !== row.cleanupReleaseId) {
      yield* writer
        .table("tryoutRuntimeBundles")
        .patch(row._id, {
          cleanupReleaseId,
        })
        .pipe(Effect.orDie);
    }
    return;
  }
  if (row.cleanupReleaseId === undefined) {
    return;
  }
  if (retention.retainedByAttempt) {
    return;
  }
  yield* writer.table("tryoutRuntimeBundles").delete(row._id);
});

/** Reads every permanent runtime pair addressed by one signed release. */
export const readReleaseTryoutRuntime = Effect.fn(
  "contentRelease.readReleaseTryoutRuntime"
)(function* (release: SignedContentRelease) {
  const transition = release.manifest.snapshots.tryout;
  const rendererManifestHash = release.manifest.rendererManifestHash;
  const result = transition.resultSnapshotId
    ? yield* loadTryoutRuntimeBundle(
        transition.resultSnapshotId,
        rendererManifestHash
      )
    : null;
  const needsRetainedBase =
    release.manifest.origin.kind === "git" &&
    transition.mode === "replace" &&
    transition.baseSnapshotId !== null;
  const retainedBase = needsRetainedBase
    ? yield* loadTryoutRuntimeBundle(
        transition.baseSnapshotId,
        rendererManifestHash
      )
    : null;
  return {
    result,
    retainedBase,
  };
});

/** Requires every new or restored runtime pair before activation advances. */
export const loadReleaseTryoutRuntime = Effect.fn(
  "contentRelease.loadReleaseTryoutRuntime"
)(function* (release: SignedContentRelease) {
  const runtime = yield* readReleaseTryoutRuntime(release);
  const transition = release.manifest.snapshots.tryout;
  const requiresResult = transition.resultSnapshotId !== null;
  const requiresBase =
    release.manifest.origin.kind === "git" &&
    transition.mode === "replace" &&
    transition.baseSnapshotId !== null;
  if (
    (requiresResult && runtime.result === null) ||
    (requiresBase && runtime.retainedBase === null)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out runtime pairs required by release ${release.manifest.releaseId} are unavailable.`
    );
  }
  return runtime;
});

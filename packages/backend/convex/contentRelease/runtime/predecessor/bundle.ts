import type { ProtectedContentRuntimeRequest } from "@nakafa/aksara-contracts/runtime/predecessor/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import {
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import { findTryoutBundleByRelease } from "@repo/backend/convex/tryouts/runtime/bundle";
import { loadTryoutRuntimeBundle } from "@repo/backend/convex/tryouts/runtime/signed";
import { Effect } from "effect";

/** Exact predecessor response source selected from either rollout generation. */
export interface PredecessorBundleSource {
  readonly manifestHash: string;
  readonly releaseId: string;
  readonly releaseJson: string;
  readonly rendererJson: string;
  readonly snapshotId: string;
}

/** Loads and validates the release-sized predecessor bundle when retained. */
const loadLegacyBundle = Effect.fn(
  "contentRelease.loadPredecessorLegacyBundle"
)(function* (ctx: QueryCtx, request: ProtectedContentRuntimeRequest) {
  const stored = yield* findTryoutBundleByRelease(
    ctx,
    request.snapshotReleaseId
  ).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Protected try-out bundle ${request.snapshotReleaseId} could not be read.`,
        })
    )
  );
  if (!stored) {
    return null;
  }
  const [release, renderer] = yield* Effect.all([
    decodeReleaseJson(stored.releaseJson),
    decodeRendererJson(stored.rendererJson),
  ]);
  const snapshot = release.manifest.snapshots.tryout;
  if (
    stored.manifestHash !== release.manifestHash ||
    stored.releaseId !== release.manifest.releaseId ||
    stored.snapshotId !== request.snapshotId ||
    snapshot.resultSnapshotId !== request.snapshotId ||
    !hasRendererIdentity(release.manifest, renderer)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Protected try-out bundle ${request.snapshotReleaseId} changed its identity.`
    );
  }
  return {
    manifestHash: stored.manifestHash,
    releaseId: stored.releaseId,
    releaseJson: stored.releaseJson,
    rendererJson: stored.rendererJson,
    snapshotId: stored.snapshotId,
  } satisfies PredecessorBundleSource;
});

/** Resolves the predecessor shape from a permanent runtime bundle. */
const loadPermanentBundle = Effect.fn(
  "contentRelease.loadPredecessorPermanentBundle"
)(function* (ctx: QueryCtx, request: ProtectedContentRuntimeRequest) {
  const storedRelease = yield* Effect.promise(() =>
    ctx.db
      .query("contentReleases")
      .withIndex("by_releaseId", (query) =>
        query.eq("releaseId", request.snapshotReleaseId)
      )
      .unique()
  );
  if (!storedRelease) {
    return null;
  }
  const [release, renderer] = yield* Effect.all([
    decodeReleaseJson(storedRelease.releaseJson),
    decodeRendererJson(storedRelease.rendererJson),
  ]);
  if (
    storedRelease.releaseId !== release.manifest.releaseId ||
    release.manifest.releaseId !== request.snapshotReleaseId ||
    release.manifest.snapshots.tryout.resultSnapshotId !== request.snapshotId ||
    !hasRendererIdentity(release.manifest, renderer)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Protected content release ${request.snapshotReleaseId} changed its identity.`
    );
  }
  const runtime = yield* loadTryoutRuntimeBundle(
    ctx,
    request.snapshotId,
    renderer.hash
  );
  if (!runtime) {
    return null;
  }
  if (
    storedRelease.tryoutRuntimeBundleHash !== runtime.bundle.bundleHash ||
    runtime.stored.rendererJson !== storedRelease.rendererJson
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Protected runtime bundle ${runtime.bundle.bundleHash} changed its release identity.`
    );
  }
  return {
    manifestHash: release.manifestHash,
    releaseId: release.manifest.releaseId,
    releaseJson: storedRelease.releaseJson,
    rendererJson: storedRelease.rendererJson,
    snapshotId: request.snapshotId,
  } satisfies PredecessorBundleSource;
});

/** Selects the predecessor response source across the expand window. */
export const loadPredecessorBundle = Effect.fn(
  "contentRelease.loadPredecessorBundle"
)(function* (ctx: QueryCtx, request: ProtectedContentRuntimeRequest) {
  const legacy = yield* loadLegacyBundle(ctx, request);
  if (legacy) {
    return legacy;
  }
  return yield* loadPermanentBundle(ctx, request);
});

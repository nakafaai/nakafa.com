import {
  MAX_PROTECTED_RUNTIME_REQUEST_BYTES,
  MAX_PROTECTED_RUNTIME_RESPONSE_BYTES,
  MAX_PROTECTED_RUNTIME_SELECTORS,
  protectedRuntimeResponseBytes,
} from "@nakafa/aksara-contracts/runtime/protected/limits";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import {
  decodeRendererJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/confect/contentRelease/parse";
import { loadAttemptRuntimeBundle } from "@repo/backend/confect/tryouts/runtime/attempt/source";
import type { TryoutBodyBatch } from "@repo/backend/confect/tryouts/runtime/body";
import {
  readHistoryArtifact,
  readHistoryPlacement,
} from "@repo/backend/confect/tryouts/runtime/history/placement";
import {
  TryoutHistoryError,
  type TryoutHistoryRequest,
} from "@repo/backend/confect/tryouts/runtime/history/spec";
import { readOwnedAttemptById } from "@repo/backend/confect/tryouts/runtime/lookup";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { loadVerifiedSnapshot } from "@repo/backend/content/publication/snapshot";
import { Effect } from "effect";

/** Reads a bounded signed batch under fresh session, ownership and phase checks. */
export const readTryoutHistory = Effect.fn("tryouts.history.read")(function* (
  request: TryoutHistoryRequest
) {
  const auth = yield* getOptionalAppUserForRead();
  if (!auth) {
    return null;
  }
  if (
    request.selectors.length === 0 ||
    request.selectors.length > MAX_PROTECTED_RUNTIME_SELECTORS ||
    protectedRuntimeResponseBytes(request) > MAX_PROTECTED_RUNTIME_REQUEST_BYTES
  ) {
    return yield* new TryoutHistoryError({
      code: "TRYOUT_HISTORY_REQUEST_INVALID",
      message: "Try-out history request exceeds its batch bounds.",
    });
  }
  const attempt = yield* readOwnedAttemptById(
    request.attemptId,
    auth.appUser._id
  );
  if (!attempt) {
    return null;
  }
  const placements: NonNullable<
    Effect.Success<ReturnType<typeof readHistoryPlacement>>
  >[] = [];
  for (const selector of request.selectors) {
    const placement = yield* readHistoryPlacement(attempt, selector);
    if (!placement) {
      return null;
    }
    placements.push(placement);
  }
  const stored = yield* loadAttemptRuntimeBundle(attempt);
  const [bundle, renderer] = yield* Effect.all([
    decodeTryoutRuntimeBundleJson(stored.bundleJson),
    decodeRendererJson(stored.rendererJson),
  ]);
  if (
    bundle.bundleHash !== stored.bundleHash ||
    bundle.payload.snapshot.snapshotId !== stored.snapshotId ||
    bundle.payload.rendererManifestHash !== stored.rendererManifestHash ||
    renderer.hash !== stored.rendererManifestHash ||
    bundle.payload.sourceGitSha !== stored.sourceGitSha ||
    bundle.payload.sourceManifestHash !== stored.sourceManifestHash ||
    bundle.payload.sourceReleaseId !== stored.sourceReleaseId
  ) {
    return yield* new TryoutHistoryError({
      code: "TRYOUT_HISTORY_INTEGRITY",
      message: "Try-out history lost its permanent bundle identity.",
    });
  }
  yield* loadVerifiedSnapshot("tryout", attempt.tryoutSnapshotId).pipe(
    Effect.provide(publicationLayer)
  );
  const result: TryoutBodyBatch = {
    bundleJson: stored.bundleJson,
    items: [],
    rendererJson: stored.rendererJson,
  };
  let responseBytes = protectedRuntimeResponseBytes(result);
  for (const placement of placements) {
    const item = yield* readHistoryArtifact(placement);
    responseBytes +=
      protectedRuntimeResponseBytes(item) + (result.items.length > 0 ? 1 : 0);
    if (responseBytes > MAX_PROTECTED_RUNTIME_RESPONSE_BYTES) {
      return yield* new TryoutHistoryError({
        code: "TRYOUT_HISTORY_RESPONSE_TOO_LARGE",
        message: "Try-out history exceeds its response byte limit.",
      });
    }
    result.items.push(item);
  }
  return result;
});

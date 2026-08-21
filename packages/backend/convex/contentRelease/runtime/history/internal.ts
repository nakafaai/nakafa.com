import {
  StoredProtectedRuntimeFoundSchema,
  type StoredProtectedRuntimeRequest,
  StoredProtectedRuntimeRequestSchema,
} from "@nakafa/aksara-contracts/history/decode";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { parseStoredJson } from "@repo/backend/convex/contentRelease/parse";
import { loadRetainedRuntimeItems } from "@repo/backend/convex/contentRelease/runtime/history/items";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { readTryoutAttemptHistory } from "@repo/backend/convex/tryouts/history/reference";
import { findTryoutBundleByRelease } from "@repo/backend/convex/tryouts/runtime/bundle";
import { type Infer, v } from "convex/values";
import { Effect, Schema } from "effect";

const deliveryValidator = v.union(
  v.literal("authenticated"),
  v.literal("entitled")
);
/** Exact locale vocabulary frozen into the retained-history protocol. */
const historicalLocaleValidator = v.union(v.literal("en"), v.literal("id"));
const selectorValidator = v.object({
  artifactHash: v.string(),
  artifactLocale: historicalLocaleValidator,
  contentKey: v.string(),
  delivery: deliveryValidator,
});
const argsValidator = {
  appLocale: historicalLocaleValidator,
  attemptId: v.string(),
  selectors: v.array(selectorValidator),
  snapshotId: v.string(),
  snapshotReleaseId: v.string(),
};
const itemValidator = v.object({
  artifactJson: v.string(),
  delivery: deliveryValidator,
  sourcePath: v.string(),
});
const resultValidator = v.union(
  v.null(),
  v.object({
    appLocale: historicalLocaleValidator,
    attemptId: v.string(),
    items: v.array(itemValidator),
    releaseJson: v.string(),
    rendererJson: v.string(),
    snapshotId: v.string(),
    snapshotManifestHash: v.string(),
    snapshotReleaseId: v.string(),
  })
);
/** Historical bytes returned only across the private action boundary. */
export type RetainedRuntimeBatchRow = Infer<typeof resultValidator>;
/** Creates one stable fail-closed retained-runtime error. */
function historyIntegrity(message: string) {
  return new ReleaseError({
    code: "CONTENT_RELEASE_INTEGRITY",
    message,
  });
}
/** Loads the exact attempt before any history discriminator or bytes. */
const loadAttempt = Effect.fn("contentRelease.loadRetainedRuntimeAttempt")(
  function* (ctx: QueryCtx, request: StoredProtectedRuntimeRequest) {
    const attemptId = ctx.db.normalizeId("tryoutAttempts", request.attemptId);
    if (!attemptId) {
      return null;
    }
    const attempt = yield* Effect.promise(() => ctx.db.get(attemptId));
    if (!attempt) {
      return null;
    }
    if (
      attempt.appLocale !== request.appLocale ||
      attempt.tryoutSnapshotId !== request.snapshotId ||
      attempt.snapshotReleaseId !== request.snapshotReleaseId
    ) {
      return null;
    }
    return attempt;
  }
);
/** Loads the exact old bundle selected by the attempt marker. */
const loadBundle = Effect.fn("contentRelease.loadRetainedRuntimeBundle")(
  function* (ctx: QueryCtx, request: StoredProtectedRuntimeRequest) {
    const bundle = yield* findTryoutBundleByRelease(
      ctx,
      request.snapshotReleaseId
    ).pipe(
      Effect.mapError(() =>
        historyIntegrity("Unable to read the retained try-out bundle.")
      )
    );
    if (!bundle) {
      return null;
    }
    if (
      bundle.releaseId !== request.snapshotReleaseId ||
      bundle.snapshotId !== request.snapshotId
    ) {
      return yield* historyIntegrity(
        "Retained try-out bundle changed its immutable identity."
      );
    }
    return bundle;
  }
);
/** Resolves one complete retained batch in a single read transaction. */
const readProgram = Effect.fn("contentRelease.readRetainedRuntimeBatch")(
  function* (ctx: QueryCtx, input: unknown) {
    const request = yield* Schema.decodeUnknownEffect(
      StoredProtectedRuntimeRequestSchema,
      { onExcessProperty: "error" }
    )(input).pipe(
      Effect.mapError(() => historyIntegrity("Retained request is invalid."))
    );
    const attempt = yield* loadAttempt(ctx, request);
    if (!attempt) {
      return null;
    }
    const marker = yield* readTryoutAttemptHistory(ctx, attempt).pipe(
      Effect.mapError(() =>
        historyIntegrity("Retained attempt marker is invalid.")
      )
    );
    if (!marker) {
      return null;
    }
    const items = yield* loadRetainedRuntimeItems(ctx, request, attempt);
    if (!items) {
      return null;
    }
    const bundle = yield* loadBundle(ctx, request);
    if (!bundle) {
      return null;
    }
    const rendererManifest = yield* parseStoredJson(
      bundle.rendererJson,
      "Retained renderer manifest"
    );
    const release = yield* parseStoredJson(
      bundle.releaseJson,
      "Retained signed release"
    );
    const artifacts = yield* Effect.forEach(items, (item) =>
      parseStoredJson(item.artifactJson, "Retained signed artifact")
    );
    const found = yield* Schema.decodeUnknownEffect(
      StoredProtectedRuntimeFoundSchema
    )(
      {
        appLocale: request.appLocale,
        attemptId: request.attemptId,
        items: items.map((item, index) => ({
          artifact: artifacts[index],
          delivery: item.delivery,
          sourcePath: item.sourcePath,
        })),
        kind: "found",
        release,
        rendererManifest,
        snapshotId: request.snapshotId,
        snapshotManifestHash: bundle.manifestHash,
        snapshotReleaseId: request.snapshotReleaseId,
      },
      { onExcessProperty: "error" }
    ).pipe(
      Effect.mapError(() =>
        historyIntegrity("Retained runtime bytes are invalid.")
      )
    );
    if (
      found.release.manifest.releaseId !== bundle.releaseId ||
      found.release.manifestHash !== bundle.manifestHash ||
      found.release.manifest.snapshots.tryout.resultSnapshotId !==
        bundle.snapshotId ||
      found.rendererManifest.hash !==
        found.release.manifest.rendererManifestHash
    ) {
      return yield* historyIntegrity(
        "Retained try-out bundle changed its historical contract."
      );
    }
    return {
      appLocale: request.appLocale,
      attemptId: request.attemptId,
      items,
      releaseJson: bundle.releaseJson,
      rendererJson: bundle.rendererJson,
      snapshotId: request.snapshotId,
      snapshotManifestHash: bundle.manifestHash,
      snapshotReleaseId: request.snapshotReleaseId,
    };
  }
);
/** Returns attempt-bound historical bytes only through the private action. */
export const read = internalQuery({
  args: argsValidator,
  returns: resultValidator,
  handler: (ctx, args) => runConvexProgram(readProgram(ctx, args)),
});

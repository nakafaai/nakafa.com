import type { RendererManifestEnvelope } from "@nakafa/aksara-contracts/renderer/contract";
import { verifyTryoutRuntimeBundleSource } from "@nakafa/aksara-contracts/tryout/runtime/source";
import type { SignedTryoutRuntimeBundle } from "@nakafa/aksara-contracts/tryout/runtime/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadStaged } from "@repo/backend/convex/contentRelease/model";
import {
  decodeReleaseJson,
  decodeRendererJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import { tryoutRuntimeBundleReceiptValidator } from "@repo/backend/convex/contentRelease/spec";
import { encodeTryoutRuntimeBundleJson } from "@repo/backend/convex/contentRelease/wire";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { type Infer, v } from "convex/values";
import { Clock, Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;
type RuntimeReceipt = Infer<typeof tryoutRuntimeBundleReceiptValidator>;

/** Reads one permanent runtime bundle by its content-addressed identity. */
export const findTryoutRuntimeBundleByHash = Effect.fn(
  "tryouts.runtime.findTryoutRuntimeBundleByHash"
)(function* (ctx: ReadCtx, bundleHash: string) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("tryoutRuntimeBundles")
      .withIndex("by_bundleHash", (query) => query.eq("bundleHash", bundleHash))
      .unique()
  );
});

/** Reads the permanent bundle selected by one snapshot and renderer pair. */
export const findTryoutRuntimeBundle = Effect.fn(
  "tryouts.runtime.findTryoutRuntimeBundle"
)(function* (ctx: ReadCtx, snapshotId: string, rendererManifestHash: string) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("tryoutRuntimeBundles")
      .withIndex("by_snapshotId_and_rendererManifestHash", (query) =>
        query
          .eq("snapshotId", snapshotId)
          .eq("rendererManifestHash", rendererManifestHash)
      )
      .unique()
  );
});

/** Loads one pair-selected bundle and validates its duplicated lookup facts. */
export const loadTryoutRuntimeBundle = Effect.fn(
  "tryouts.runtime.loadTryoutRuntimeBundle"
)(function* (ctx: ReadCtx, snapshotId: string, rendererManifestHash: string) {
  const stored = yield* findTryoutRuntimeBundle(
    ctx,
    snapshotId,
    rendererManifestHash
  );
  if (!stored) {
    return null;
  }
  const [bundle, renderer] = yield* Effect.all([
    decodeTryoutRuntimeBundleJson(stored.bundleJson),
    decodeRendererJson(stored.rendererJson),
  ]);
  if (
    stored.bundleHash !== bundle.bundleHash ||
    stored.snapshotId !== bundle.payload.snapshot.snapshotId ||
    stored.snapshotId !== snapshotId ||
    stored.rendererManifestHash !== bundle.payload.rendererManifestHash ||
    stored.rendererManifestHash !== rendererManifestHash ||
    renderer.hash !== rendererManifestHash ||
    stored.sourceGitSha !== bundle.payload.sourceGitSha ||
    stored.sourceManifestHash !== bundle.payload.sourceManifestHash ||
    stored.sourceReleaseId !== bundle.payload.sourceReleaseId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out runtime bundle ${stored.bundleHash} changed its identity.`
    );
  }
  return { bundle, renderer, stored };
});

/** Rejects reuse of one bundle identity with different stored bytes. */
const verifyStoredRuntimeBundle = Effect.fn(
  "tryouts.runtime.verifyStoredRuntimeBundle"
)(function* (
  stored: Doc<"tryoutRuntimeBundles">,
  bundle: SignedTryoutRuntimeBundle,
  renderer: RendererManifestEnvelope,
  bundleJson: string,
  rendererJson: string
) {
  if (
    stored.bundleJson !== bundleJson ||
    stored.rendererJson !== rendererJson
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Try-out runtime bundle ${stored.bundleHash} was reused with different bytes.`
    );
  }
  if (
    stored.bundleHash !== bundle.bundleHash ||
    stored.snapshotId !== bundle.payload.snapshot.snapshotId ||
    stored.rendererManifestHash !== bundle.payload.rendererManifestHash ||
    stored.rendererManifestHash !== renderer.hash ||
    stored.sourceGitSha !== bundle.payload.sourceGitSha ||
    stored.sourceManifestHash !== bundle.payload.sourceManifestHash ||
    stored.sourceReleaseId !== bundle.payload.sourceReleaseId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out runtime bundle ${bundle.bundleHash} changed its stored identity.`
    );
  }
});

/** Stores one already-authenticated permanent bundle by exact immutable bytes. */
export const storeAuthenticatedTryoutRuntimeBundle = Effect.fn(
  "tryouts.runtime.storeAuthenticatedTryoutRuntimeBundle"
)(function* (
  ctx: MutationCtx,
  bundle: SignedTryoutRuntimeBundle,
  renderer: RendererManifestEnvelope,
  createdAt?: number
) {
  const storedAt = createdAt ?? (yield* Clock.currentTimeMillis);
  const bundleJson = encodeTryoutRuntimeBundleJson(bundle);
  const rendererJson = JSON.stringify(renderer);
  if (renderer.hash !== bundle.payload.rendererManifestHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out runtime bundle ${bundle.bundleHash} has incoherent renderer or snapshot bytes.`
    );
  }
  const existing = yield* findTryoutRuntimeBundleByHash(ctx, bundle.bundleHash);
  if (existing) {
    yield* verifyStoredRuntimeBundle(
      existing,
      bundle,
      renderer,
      bundleJson,
      rendererJson
    );
    return {
      bundleHash: bundle.bundleHash,
      created: 0,
      releaseId: bundle.payload.sourceReleaseId,
      snapshotId: bundle.payload.snapshot.snapshotId,
      unchanged: 1,
    } satisfies RuntimeReceipt;
  }
  const pair = yield* loadTryoutRuntimeBundle(
    ctx,
    bundle.payload.snapshot.snapshotId,
    bundle.payload.rendererManifestHash
  );
  if (pair) {
    if (
      JSON.stringify(pair.bundle.payload.snapshot) !==
        JSON.stringify(bundle.payload.snapshot) ||
      pair.stored.rendererJson !== rendererJson
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Try-out snapshot ${bundle.payload.snapshot.snapshotId} reused renderer ${bundle.payload.rendererManifestHash} with different bytes.`
      );
    }
    return {
      bundleHash: pair.bundle.bundleHash,
      created: 0,
      releaseId: bundle.payload.sourceReleaseId,
      snapshotId: bundle.payload.snapshot.snapshotId,
      unchanged: 1,
    } satisfies RuntimeReceipt;
  }
  const row = {
    bundleHash: bundle.bundleHash,
    bundleJson,
    cleanupReleaseId: bundle.payload.sourceReleaseId,
    createdAt: storedAt,
    rendererJson,
    rendererManifestHash: bundle.payload.rendererManifestHash,
    snapshotId: bundle.payload.snapshot.snapshotId,
    sourceGitSha: bundle.payload.sourceGitSha,
    sourceManifestHash: bundle.payload.sourceManifestHash,
    sourceReleaseId: bundle.payload.sourceReleaseId,
  };
  yield* ensureDocumentSize(`Try-out runtime bundle ${bundle.bundleHash}`, row);
  yield* Effect.promise(() => ctx.db.insert("tryoutRuntimeBundles", row));
  return {
    bundleHash: bundle.bundleHash,
    created: 1,
    releaseId: bundle.payload.sourceReleaseId,
    snapshotId: bundle.payload.snapshot.snapshotId,
    unchanged: 0,
  } satisfies RuntimeReceipt;
});

/** Stores one authenticated bundle while its source release owns staging. */
export const stageTryoutRuntimeBundleProgram = Effect.fn(
  "tryouts.runtime.stageTryoutRuntimeBundle"
)(function* (
  ctx: MutationCtx,
  sourceBundleJson: string,
  sourceRendererJson: string,
  createdAt?: number
) {
  const bundle = yield* decodeTryoutRuntimeBundleJson(sourceBundleJson);
  const renderer = yield* decodeRendererJson(sourceRendererJson);
  const rendererJson = JSON.stringify(renderer);
  const { release } = yield* loadStaged(ctx, bundle.payload.sourceReleaseId);
  const signedRelease = yield* decodeReleaseJson(release.releaseJson);
  const acceptsBundle =
    release.status === "staging" ||
    (release.status === "verified" &&
      release.tryoutRuntimeRequired === undefined);
  if (!acceptsBundle || release.abortingAt !== undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${release.releaseId} no longer accepts a try-out runtime bundle.`
    );
  }
  yield* verifyTryoutRuntimeBundleSource({
    bundle,
    release: signedRelease,
  }).pipe(Effect.mapError(contractFailure));
  if (
    renderer.hash !== bundle.payload.rendererManifestHash ||
    release.rendererJson !== rendererJson
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out runtime bundle ${bundle.bundleHash} does not match its staged source release.`
    );
  }
  return yield* storeAuthenticatedTryoutRuntimeBundle(
    ctx,
    bundle,
    renderer,
    createdAt
  );
});

/** Persists one Node-authenticated permanent runtime bundle atomically. */
export const stageTryoutRuntimeBundle = internalMutation({
  args: { bundleJson: v.string(), rendererJson: v.string() },
  returns: tryoutRuntimeBundleReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      stageTryoutRuntimeBundleProgram(ctx, args.bundleJson, args.rendererJson)
    ),
});

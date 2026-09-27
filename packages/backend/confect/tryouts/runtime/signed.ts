import type { RendererManifestEnvelope } from "@nakafa/aksara-contracts/renderer/contract";
import { verifyTryoutRuntimeBundleSource } from "@nakafa/aksara-contracts/tryout/runtime/source";
import type { SignedTryoutRuntimeBundle } from "@nakafa/aksara-contracts/tryout/runtime/spec";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { ensureDocumentSize } from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadStaged } from "@repo/backend/confect/contentRelease/model";
import {
  decodeReleaseJson,
  decodeRendererJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/confect/contentRelease/parse";
import { contractFailure } from "@repo/backend/confect/contentRelease/proof/failure";
import type { tryoutRuntimeBundleReceiptValidator } from "@repo/backend/confect/contentRelease/spec";
import { encodeTryoutRuntimeBundleJson } from "@repo/backend/confect/contentRelease/wire";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { Clock, Effect, type Schema } from "effect";
export type ReadCtx = MutationCtx | QueryCtx;
export type RuntimeReceipt = Schema.Schema.Type<
  typeof tryoutRuntimeBundleReceiptValidator
>;

/** Reads one permanent runtime bundle by its content-addressed identity. */
export const findTryoutRuntimeBundleByHash = Effect.fn(
  "tryouts.runtime.findTryoutRuntimeBundleByHash"
)(function* (bundleHash: string) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("tryoutRuntimeBundles")
    .get("by_bundleHash", bundleHash)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** Reads the permanent bundle selected by one snapshot and renderer pair. */
export const findTryoutRuntimeBundle = Effect.fn(
  "tryouts.runtime.findTryoutRuntimeBundle"
)(function* (snapshotId: string, rendererManifestHash: string) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("tryoutRuntimeBundles")
    .get(
      "by_snapshotId_and_rendererManifestHash",
      snapshotId,
      rendererManifestHash
    )
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** Loads one pair-selected bundle and validates its duplicated lookup facts. */
export const loadTryoutRuntimeBundle = Effect.fn(
  "tryouts.runtime.loadTryoutRuntimeBundle"
)(function* (snapshotId: string, rendererManifestHash: string) {
  const stored = yield* findTryoutRuntimeBundle(
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
  return {
    bundle,
    renderer,
    stored,
  };
});

/** Rejects reuse of one bundle identity with different stored bytes. */
export const verifyStoredRuntimeBundle = Effect.fn(
  "tryouts.runtime.verifyStoredRuntimeBundle"
)(function* (
  stored: Docs["tryoutRuntimeBundles"],
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
  bundle: SignedTryoutRuntimeBundle,
  renderer: RendererManifestEnvelope,
  createdAt?: number
) {
  const writer = yield* DatabaseWriter;
  const storedAt = createdAt ?? (yield* Clock.currentTimeMillis);
  const bundleJson = encodeTryoutRuntimeBundleJson(bundle);
  const rendererJson = JSON.stringify(renderer);
  if (renderer.hash !== bundle.payload.rendererManifestHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out runtime bundle ${bundle.bundleHash} has incoherent renderer or snapshot bytes.`
    );
  }
  const existing = yield* findTryoutRuntimeBundleByHash(bundle.bundleHash);
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
  yield* writer.table("tryoutRuntimeBundles").insert(row).pipe(Effect.orDie);
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
  sourceBundleJson: string,
  sourceRendererJson: string,
  createdAt?: number
) {
  const bundle = yield* decodeTryoutRuntimeBundleJson(sourceBundleJson);
  const renderer = yield* decodeRendererJson(sourceRendererJson);
  const rendererJson = JSON.stringify(renderer);
  const { release } = yield* loadStaged(bundle.payload.sourceReleaseId);
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
    bundle,
    renderer,
    createdAt
  );
});

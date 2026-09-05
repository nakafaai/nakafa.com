import { CorpusSourcePathSchema } from "@nakafa/aksara-contracts/ids";
import type {
  ProtectedContentRuntimeFound,
  ProtectedContentRuntimeRequest,
} from "@nakafa/aksara-contracts/runtime/protected/spec";
import { verifySignedTryoutRuntimeBundle } from "@nakafa/aksara-contracts/tryout/runtime/verify";
import type { ProtectedRuntimeBatchRow } from "@repo/backend/content/tryout/protected";
import {
  decodeArtifactJson,
  decodeRendererJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import { Effect, Schema } from "effect";
export class ProtectedRuntimeReadError extends Schema.TaggedError<ProtectedRuntimeReadError>()(
  "ProtectedRuntimeReadError",
  {}
) {}
/** Authenticates stored protected bytes against their immutable request identity. */
export const decodeProtectedRuntimeRow = Effect.fn(
  "contentRelease.decodeProtectedRuntimeRow"
)(function* (
  row: ProtectedRuntimeBatchRow,
  request: ProtectedContentRuntimeRequest
) {
  if (row === null) {
    return null;
  }
  const [items, decodedBundle, rendererManifest] = yield* Effect.all([
    Effect.forEach(
      row.items,
      (item) =>
        Effect.all({
          artifact: decodeArtifactJson(item.artifactJson),
          delivery: Effect.succeed(item.delivery),
          sourcePath: Schema.decodeEffect(CorpusSourcePathSchema)(
            item.sourcePath
          ),
        }),
      { concurrency: "unbounded" }
    ),
    decodeTryoutRuntimeBundleJson(row.bundleJson),
    decodeRendererJson(row.rendererJson),
  ]).pipe(Effect.mapError(() => new ProtectedRuntimeReadError()));
  const bundle = yield* verifySignedTryoutRuntimeBundle({
    bundle: decodedBundle,
    rendererManifest,
  }).pipe(Effect.mapError(() => new ProtectedRuntimeReadError()));
  if (
    bundle.bundleHash !== request.bundleHash ||
    bundle.payload.snapshot.snapshotId !== request.snapshotId
  ) {
    return yield* new ProtectedRuntimeReadError();
  }
  return {
    bundle,
    items,
    kind: "found",
    rendererManifest,
  } satisfies ProtectedContentRuntimeFound;
});

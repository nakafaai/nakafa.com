import { CorpusSourcePathSchema } from "@nakafa/aksara-contracts/ids";
import {
  decodeProtectedContentRuntimeRequest,
  type ProtectedContentRuntimeFound,
  type ProtectedContentRuntimeRequest,
  ProtectedContentRuntimeResponseSchema,
} from "@nakafa/aksara-contracts/runtime/predecessor/spec";
import {
  MAX_PROTECTED_RUNTIME_REQUEST_BYTES,
  MAX_PROTECTED_RUNTIME_RESPONSE_BYTES,
  protectedRuntimeResponseBytes,
} from "@nakafa/aksara-contracts/runtime/protected/limits";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  decodeArtifactJson,
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import type { ProtectedRuntimeBatchRow } from "@repo/backend/convex/contentRelease/runtime/predecessor/internal";
import {
  encodeRuntimeResult,
  failureResult,
} from "@repo/backend/convex/contentRelease/runtime/result";
import { makeFunctionReference } from "convex/server";
import { Effect, Result, Schema } from "effect";

const protectedReadReference = makeFunctionReference<
  "query",
  ProtectedContentRuntimeRequest,
  ProtectedRuntimeBatchRow
>("contentRelease/runtime/predecessor/internal:read");

/** Request JSON could not satisfy the predecessor protected contract. */
class ProtectedRuntimeRequestError extends Schema.TaggedError<ProtectedRuntimeRequestError>()(
  "ProtectedRuntimeRequestError",
  {}
) {}

/** Convex or stored predecessor data failed before a safe response. */
class ProtectedRuntimeReadError extends Schema.TaggedError<ProtectedRuntimeReadError>()(
  "ProtectedRuntimeReadError",
  {}
) {}

/** Strictly parses one bounded predecessor batch request. */
const decodeProtectedRequest = Effect.fn(
  "contentRelease.decodePredecessorProtectedRequest"
)(function* (source: string, byteLength: number) {
  const measured = new TextEncoder().encode(source).byteLength;
  if (
    byteLength !== measured ||
    measured > MAX_PROTECTED_RUNTIME_REQUEST_BYTES
  ) {
    return yield* new ProtectedRuntimeRequestError();
  }
  const input = yield* Effect.try({
    catch: () => new ProtectedRuntimeRequestError(),
    try: (): unknown => JSON.parse(source),
  });
  return yield* decodeProtectedContentRuntimeRequest(input).pipe(
    Effect.mapError(() => new ProtectedRuntimeRequestError())
  );
});

/** Reads one retained-snapshot batch for predecessor verification. */
const resolveProtectedRuntime = Effect.fn(
  "contentRelease.resolvePredecessorProtectedRuntime"
)(function* (ctx: ActionCtx, request: ProtectedContentRuntimeRequest) {
  const row = yield* Effect.tryPromise({
    catch: () => new ProtectedRuntimeReadError(),
    try: (): Promise<ProtectedRuntimeBatchRow> =>
      ctx.runQuery(protectedReadReference, request),
  });
  if (row === null) {
    return null;
  }
  const [items, release, rendererManifest] = yield* Effect.all([
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
    decodeReleaseJson(row.releaseJson),
    decodeRendererJson(row.rendererJson),
  ]).pipe(Effect.mapError(() => new ProtectedRuntimeReadError()));
  if (
    row.snapshotManifestHash !== release.manifestHash ||
    row.snapshotReleaseId !== release.manifest.releaseId ||
    row.snapshotReleaseId !== request.snapshotReleaseId ||
    row.snapshotId !== request.snapshotId
  ) {
    return yield* new ProtectedRuntimeReadError();
  }
  const response: ProtectedContentRuntimeFound = {
    items,
    kind: "found",
    release,
    rendererManifest,
    snapshotId: request.snapshotId,
    snapshotManifestHash: release.manifestHash,
    snapshotReleaseId: release.manifest.releaseId,
  };
  return response;
});

/** Decodes, resolves, and safely encodes one predecessor request. */
export const dispatchProgram = Effect.fn(
  "contentRelease.predecessorProtectedRuntimeDispatch"
)(function* (ctx: ActionCtx, source: string, byteLength: number) {
  const decoded = yield* decodeProtectedRequest(source, byteLength).pipe(
    Effect.result
  );
  if (Result.isFailure(decoded)) {
    return failureResult("CONTENT_RUNTIME_INVALID", 400);
  }
  const resolved = yield* resolveProtectedRuntime(ctx, decoded.success).pipe(
    Effect.result
  );
  if (Result.isFailure(resolved)) {
    return failureResult("CONTENT_RUNTIME_INTERNAL", 500);
  }
  if (resolved.success === null) {
    return encodeRuntimeResult(
      ProtectedContentRuntimeResponseSchema,
      MAX_PROTECTED_RUNTIME_RESPONSE_BYTES,
      { kind: "missing" },
      404
    );
  }
  if (
    protectedRuntimeResponseBytes(resolved.success) >
    MAX_PROTECTED_RUNTIME_RESPONSE_BYTES
  ) {
    return failureResult("CONTENT_RUNTIME_RESPONSE_TOO_LARGE", 500);
  }
  return encodeRuntimeResult(
    ProtectedContentRuntimeResponseSchema,
    MAX_PROTECTED_RUNTIME_RESPONSE_BYTES,
    resolved.success,
    200
  );
});

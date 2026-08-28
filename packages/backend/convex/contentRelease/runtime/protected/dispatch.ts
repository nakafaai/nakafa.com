"use node";

import { CorpusSourcePathSchema } from "@nakafa/aksara-contracts/ids";
import {
  MAX_PROTECTED_RUNTIME_REQUEST_BYTES,
  MAX_PROTECTED_RUNTIME_RESPONSE_BYTES,
  protectedRuntimeResponseBytes,
} from "@nakafa/aksara-contracts/runtime/protected/limits";
import {
  decodeProtectedContentRuntimeRequest,
  type ProtectedContentRuntimeFound,
  type ProtectedContentRuntimeRequest,
  ProtectedContentRuntimeResponseSchema,
} from "@nakafa/aksara-contracts/runtime/protected/spec";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { verifySignedTryoutRuntimeBundle } from "@nakafa/aksara-contracts/tryout/runtime/verify";
import { contentKeyResolver } from "@repo/backend/content/trust";
import {
  type ActionCtx,
  internalAction,
} from "@repo/backend/convex/_generated/server";
import {
  decodeArtifactJson,
  decodeRendererJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import type { ProtectedRuntimeBatchRow } from "@repo/backend/convex/contentRelease/runtime/protected/internal";
import {
  encodeRuntimeResult,
  failureResult,
} from "@repo/backend/convex/contentRelease/runtime/result";
import { runConvexActionProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { Effect, Result, Schema } from "effect";

const protectedReadReference = makeFunctionReference<
  "query",
  ProtectedContentRuntimeRequest,
  ProtectedRuntimeBatchRow
>("contentRelease/runtime/protected/internal:read");

/** Request JSON could not satisfy the exact protected runtime contract. */
class ProtectedRuntimeRequestError extends Schema.TaggedError<ProtectedRuntimeRequestError>()(
  "ProtectedRuntimeRequestError",
  {}
) {}

/** Convex or stored protected runtime data failed before a safe response. */
class ProtectedRuntimeReadError extends Schema.TaggedError<ProtectedRuntimeReadError>()(
  "ProtectedRuntimeReadError",
  {}
) {}

/** Strictly parses one bounded UTF-8 protected batch request. */
const decodeProtectedRequest = Effect.fn(
  "contentRelease.decodeProtectedRequest"
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

/** Reads and authenticates one permanent protected artifact batch. */
const resolveProtectedRuntime = Effect.fn(
  "contentRelease.resolveProtectedRuntime"
)(function* (ctx: ActionCtx, request: ProtectedContentRuntimeRequest) {
  const row = yield* Effect.tryPromise({
    catch: () => new ProtectedRuntimeReadError(),
    try: (): Promise<ProtectedRuntimeBatchRow> =>
      ctx.runQuery(protectedReadReference, request),
  });
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

/** Decodes, resolves, and safely encodes one protected runtime request. */
export const dispatchProgram = Effect.fn(
  "contentRelease.protectedRuntimeDispatch"
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

/** Runs protected verification with the production trust registry in Node. */
export function dispatchHandler(
  ctx: ActionCtx,
  input: { readonly byteLength: number; readonly source: string }
) {
  return runConvexActionProgram(
    dispatchProgram(ctx, input.source, input.byteLength).pipe(
      Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver)
    )
  );
}

/** Node boundary required by the signed Ed25519 runtime verifier. */
export const dispatch = internalAction({
  args: { byteLength: v.number(), source: v.string() },
  returns: v.object({ body: v.string(), status: v.number() }),
  handler: dispatchHandler,
});

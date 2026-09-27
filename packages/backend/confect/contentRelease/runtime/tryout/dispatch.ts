"use node";

import { QueryRunner } from "@confect/server";
import {
  MAX_PROTECTED_RUNTIME_REQUEST_BYTES,
  MAX_PROTECTED_RUNTIME_RESPONSE_BYTES,
  protectedRuntimeResponseBytes,
} from "@nakafa/aksara-contracts/runtime/protected/limits";
import {
  decodeProtectedContentRuntimeRequest,
  type ProtectedContentRuntimeRequest,
  ProtectedContentRuntimeResponseSchema,
} from "@nakafa/aksara-contracts/runtime/protected/spec";
import refs from "@repo/backend/confect/_generated/refs";
import {
  encodeRuntimeResult,
  failureResult,
} from "@repo/backend/confect/contentRelease/runtime/result";
import { ProtectedRuntimeRequestError } from "@repo/backend/confect/contentRelease/runtime/tryout/dispatch.spec";
import {
  decodeProtectedRuntimeRow,
  ProtectedRuntimeReadError,
} from "@repo/backend/content/tryout/exchange";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { Effect, flow, Result } from "effect";
/** Strictly parses one bounded UTF-8 protected batch request. */
export const decodeProtectedRequest = Effect.fn(
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
export const resolveProtectedRuntime = Effect.fn(
  "contentRelease.resolveProtectedRuntime"
)(function* (ctx: ActionCtx, request: ProtectedContentRuntimeRequest) {
  const runQuery = yield* QueryRunner.QueryRunner.pipe(
    Effect.provide(QueryRunner.layer(ctx.runQuery))
  );
  const row = yield* runQuery(
    refs.internal.contentRelease.runtime.tryout.internal.read,
    {
      ...request,
      selectors: [...request.selectors],
    }
  ).pipe(
    Effect.mapError(() => new ProtectedRuntimeReadError()),
    Effect.catchDefect(flow(() => new ProtectedRuntimeReadError(), Effect.fail))
  );
  return yield* decodeProtectedRuntimeRow(row, request);
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
      {
        kind: "missing",
      },
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

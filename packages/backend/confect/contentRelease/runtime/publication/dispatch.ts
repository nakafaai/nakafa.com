import { QueryRunner } from "@confect/server";
import {
  decodePublicContentRuntimeRequest,
  MAX_PUBLIC_RUNTIME_REQUEST_BYTES,
  MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
  type PublicContentRuntimeRequest,
  PublicContentRuntimeResponseSchema,
} from "@nakafa/aksara-contracts/runtime/spec";
import refs from "@repo/backend/confect/_generated/refs";
import {
  encodeRuntimeResult,
  failureResult,
} from "@repo/backend/confect/contentRelease/runtime/result";
import {
  decodePublicRuntimeRow,
  PublicRuntimeReadError,
} from "@repo/backend/content/publication/exchange";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { Effect, flow, Result, Schema } from "effect";

/** Request JSON could not satisfy the exact public runtime contract. */
class PublicRuntimeRequestError extends Schema.TaggedError<PublicRuntimeRequestError>()(
  "PublicRuntimeRequestError",
  {}
) {}
/** Strictly parses one bounded UTF-8 public request. */
const decodePublicRequest = Effect.fn("contentRelease.decodePublicRequest")(
  function* (source: string, byteLength: number) {
    const measured = new TextEncoder().encode(source).byteLength;
    if (
      byteLength !== measured ||
      measured > MAX_PUBLIC_RUNTIME_REQUEST_BYTES
    ) {
      return yield* new PublicRuntimeRequestError();
    }
    const input = yield* Effect.try({
      catch: () => new PublicRuntimeRequestError(),
      try: (): unknown => JSON.parse(source),
    });
    return yield* decodePublicContentRuntimeRequest(input).pipe(
      Effect.mapError(() => new PublicRuntimeRequestError())
    );
  }
);
/** Reads one active public artifact for Nakafa verification. */
const resolvePublicRuntime = Effect.fn("contentRelease.resolvePublicRuntime")(
  function* (ctx: ActionCtx, request: PublicContentRuntimeRequest) {
    const runQuery = yield* QueryRunner.QueryRunner.pipe(
      Effect.provide(QueryRunner.layer(ctx.runQuery))
    );
    const row = yield* runQuery(
      refs.internal.contentRelease.runtime.publication.internal.read,
      {
        appLocale: request.appLocale,
        publicPath: request.publicPath,
      }
    ).pipe(
      Effect.mapError(() => new PublicRuntimeReadError()),
      Effect.catchDefect(flow(() => new PublicRuntimeReadError(), Effect.fail))
    );
    return yield* decodePublicRuntimeRow(row);
  }
);
/** Decodes, resolves, and safely encodes one public runtime request. */
export const dispatchProgram = Effect.fn(
  "contentRelease.publicRuntimeDispatch"
)(function* (ctx: ActionCtx, source: string, byteLength: number) {
  const decoded = yield* decodePublicRequest(source, byteLength).pipe(
    Effect.result
  );
  if (Result.isFailure(decoded)) {
    return failureResult("CONTENT_RUNTIME_INVALID", 400);
  }
  const resolved = yield* resolvePublicRuntime(ctx, decoded.success).pipe(
    Effect.result
  );
  if (Result.isFailure(resolved)) {
    return failureResult("CONTENT_RUNTIME_INTERNAL", 500);
  }
  if (resolved.success === null) {
    return encodeRuntimeResult(
      PublicContentRuntimeResponseSchema,
      MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
      {
        kind: "missing",
      },
      404
    );
  }
  return encodeRuntimeResult(
    PublicContentRuntimeResponseSchema,
    MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
    resolved.success,
    200
  );
});

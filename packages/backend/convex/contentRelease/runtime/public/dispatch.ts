import {
  decodePublicContentRuntimeRequest,
  MAX_PUBLIC_RUNTIME_REQUEST_BYTES,
  MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
  type PublicContentRuntimeRequest,
  PublicContentRuntimeResponseSchema,
} from "@nakafa/aksara-contracts/runtime/spec";
import {
  decodePublicRuntimeRow,
  PublicRuntimeReadError,
} from "@repo/backend/content/publication/exchange";
import type { PublicRuntimeRow } from "@repo/backend/content/publication/public";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  encodeRuntimeResult,
  failureResult,
} from "@repo/backend/convex/contentRelease/runtime/result";
import { makeFunctionReference } from "convex/server";
import { Effect, Result, Schema } from "effect";

const publicReadReference = makeFunctionReference<
  "query",
  Pick<PublicContentRuntimeRequest, "appLocale" | "publicPath">,
  PublicRuntimeRow
>("contentRelease/runtime/public/internal:read");
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
    const row = yield* Effect.tryPromise({
      catch: () => new PublicRuntimeReadError(),
      try: (): Promise<PublicRuntimeRow> =>
        ctx.runQuery(publicReadReference, {
          appLocale: request.appLocale,
          publicPath: request.publicPath,
        }),
    });
    return yield* decodePublicRuntimeRow(row);
  }
);
/** Decodes, resolves, and safely encodes one public runtime request. */
const dispatchRuntimeProgram = Effect.fn(
  "contentRelease.dispatchPublicRuntime"
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
      { kind: "missing" },
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

/** Serves the canonical current public runtime contract. */
export const dispatchProgram = Effect.fn(
  "contentRelease.publicRuntimeDispatch"
)(function* (ctx: ActionCtx, source: string, byteLength: number) {
  return yield* dispatchRuntimeProgram(ctx, source, byteLength);
});

import { QueryRunner } from "@confect/server";
import {
  MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
  type PublicContentRuntimeRequest,
  type PublicContentRuntimeResponse,
} from "@nakafa/aksara-contracts/runtime/spec";
import refs from "@repo/backend/confect/_generated/refs";
import {
  encodeRuntimeResult,
  failureResult,
} from "@repo/backend/confect/contentRelease/runtime/result";
import {
  MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES,
  MAX_PUBLIC_RUNTIME_BATCH_RESPONSE_BYTES,
  PublicContentRuntimeBatchRequestSchema,
  PublicContentRuntimeBatchResponseSchema,
  publicRuntimeResponseBytes,
} from "@repo/backend/content/batch";
import { decodePublicRuntimeRow } from "@repo/backend/content/publication/exchange";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { Effect, flow, Result, Schema } from "effect";

class PublicRuntimeBatchRequestError extends Schema.TaggedError<PublicRuntimeBatchRequestError>()(
  "PublicRuntimeBatchRequestError",
  {}
) {}
class PublicRuntimeBatchReadError extends Schema.TaggedError<PublicRuntimeBatchReadError>()(
  "PublicRuntimeBatchReadError",
  {}
) {}
/** Strictly parses one bounded UTF-8 public batch request. */
const decodeBatchRequest = Effect.fn("contentRelease.decodePublicBatchRequest")(
  function* (source: string, byteLength: number) {
    const measured = new TextEncoder().encode(source).byteLength;
    if (
      byteLength !== measured ||
      measured > MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES
    ) {
      return yield* new PublicRuntimeBatchRequestError();
    }
    const input = yield* Effect.try({
      catch: () => new PublicRuntimeBatchRequestError(),
      try: (): unknown => JSON.parse(source),
    });
    return yield* Schema.decodeUnknownEffect(
      PublicContentRuntimeBatchRequestSchema
    )(input, {
      onExcessProperty: "error",
    }).pipe(Effect.mapError(() => new PublicRuntimeBatchRequestError()));
  }
);
/** Reads and decodes one transactionally consistent public batch. */
const resolvePublicRuntimeBatch = Effect.fn(
  "contentRelease.resolvePublicRuntimeBatch"
)(function* (ctx: ActionCtx, requests: readonly PublicContentRuntimeRequest[]) {
  const runQuery = yield* QueryRunner.QueryRunner.pipe(
    Effect.provide(QueryRunner.layer(ctx.runQuery))
  );
  const rows = yield* runQuery(
    refs.internal.contentRelease.runtime.publication.internal.readBatch,
    {
      requests: requests.map(({ appLocale, publicPath }) => ({
        appLocale,
        publicPath,
      })),
    }
  ).pipe(
    Effect.mapError(() => new PublicRuntimeBatchReadError()),
    Effect.catchDefect(
      flow(() => new PublicRuntimeBatchReadError(), Effect.fail)
    )
  );
  if (rows.length !== requests.length) {
    return yield* new PublicRuntimeBatchReadError();
  }
  return yield* Effect.forEach(rows, (row) =>
    decodePublicRuntimeRow(row).pipe(
      Effect.map(
        (
          response
        ): Exclude<
          PublicContentRuntimeResponse,
          {
            readonly kind: "failure";
          }
        > =>
          response ?? {
            kind: "missing",
          }
      ),
      Effect.mapError(() => new PublicRuntimeBatchReadError())
    )
  );
});
/** Decodes, resolves, and safely encodes one public runtime batch. */
export const dispatchBatchProgram = Effect.fn(
  "contentRelease.publicRuntimeBatchDispatch"
)(function* (ctx: ActionCtx, source: string, byteLength: number) {
  const decoded = yield* decodeBatchRequest(source, byteLength).pipe(
    Effect.result
  );
  if (Result.isFailure(decoded)) {
    return failureResult("CONTENT_RUNTIME_INVALID", 400);
  }
  const responses = yield* resolvePublicRuntimeBatch(
    ctx,
    decoded.success.requests
  ).pipe(Effect.result);
  if (Result.isFailure(responses)) {
    return failureResult("CONTENT_RUNTIME_INTERNAL", 500);
  }
  if (
    responses.success.some(
      (response) =>
        publicRuntimeResponseBytes(response) > MAX_PUBLIC_RUNTIME_RESPONSE_BYTES
    )
  ) {
    return failureResult("CONTENT_RUNTIME_RESPONSE_TOO_LARGE", 500);
  }
  return encodeRuntimeResult(
    PublicContentRuntimeBatchResponseSchema,
    MAX_PUBLIC_RUNTIME_BATCH_RESPONSE_BYTES,
    {
      responses: responses.success,
    },
    200
  );
});

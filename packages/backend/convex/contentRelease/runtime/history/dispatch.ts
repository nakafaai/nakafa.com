import {
  type StoredProtectedRuntimeFound,
  type StoredProtectedRuntimeRequest,
  StoredProtectedRuntimeRequestSchema,
  StoredProtectedRuntimeResponseSchema,
} from "@nakafa/aksara-contracts/history/decode";
import {
  MAX_PROTECTED_RUNTIME_REQUEST_BYTES,
  MAX_PROTECTED_RUNTIME_RESPONSE_BYTES,
  protectedRuntimeResponseBytes,
} from "@nakafa/aksara-contracts/runtime/protected/limits";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import type { RetainedRuntimeBatchRow } from "@repo/backend/convex/contentRelease/runtime/history/internal";
import { failureResult } from "@repo/backend/convex/contentRelease/runtime/result";
import { makeFunctionReference } from "convex/server";
import { Effect, Either, Schema } from "effect";

const readReference = makeFunctionReference<
  "query",
  StoredProtectedRuntimeRequest,
  RetainedRuntimeBatchRow
>("contentRelease/runtime/history/internal:read");

/** Request JSON could not satisfy the exact retained history contract. */
class RetainedRuntimeRequestError extends Schema.TaggedError<RetainedRuntimeRequestError>()(
  "RetainedRuntimeRequestError",
  {}
) {}

/** Convex or retained data failed before a safe history response. */
class RetainedRuntimeReadError extends Schema.TaggedError<RetainedRuntimeReadError>()(
  "RetainedRuntimeReadError",
  {}
) {}

/** Strictly parses one bounded UTF-8 attempt-owned history request. */
const decodeRequest = Effect.fn("contentRelease.decodeRetainedRequest")(
  function* (source: string, byteLength: number) {
    const measured = new TextEncoder().encode(source).byteLength;
    if (
      byteLength !== measured ||
      measured > MAX_PROTECTED_RUNTIME_REQUEST_BYTES
    ) {
      return yield* new RetainedRuntimeRequestError();
    }
    const input = yield* Effect.try({
      catch: () => new RetainedRuntimeRequestError(),
      try: (): unknown => JSON.parse(source),
    });
    return yield* Schema.decodeUnknown(StoredProtectedRuntimeRequestSchema)(
      input,
      { onExcessProperty: "error" }
    ).pipe(Effect.mapError(() => new RetainedRuntimeRequestError()));
  }
);

/** Builds one attempt-bound response through the historical wire schema. */
function encodeRetainedResult(
  request: StoredProtectedRuntimeRequest,
  outcome:
    | { readonly code: "CONTENT_RUNTIME_INTERNAL"; readonly kind: "failure" }
    | { readonly kind: "missing" }
    | StoredProtectedRuntimeFound,
  status: number
) {
  const input =
    outcome.kind === "found"
      ? outcome
      : {
          ...outcome,
          appLocale: request.appLocale,
          attemptId: request.attemptId,
        };
  const decoded = Schema.decodeUnknownEither(
    StoredProtectedRuntimeResponseSchema
  )(input, { onExcessProperty: "error" });
  if (Either.isLeft(decoded)) {
    return encodeRetainedFailure(request, "CONTENT_RUNTIME_INTERNAL");
  }
  if (
    protectedRuntimeResponseBytes(decoded.right) >
    MAX_PROTECTED_RUNTIME_RESPONSE_BYTES
  ) {
    return encodeRetainedFailure(request, "CONTENT_RUNTIME_RESPONSE_TOO_LARGE");
  }
  return { body: JSON.stringify(decoded.right), status };
}

/** Encodes one response-safe failure bound to its decoded attempt request. */
function encodeRetainedFailure(
  request: StoredProtectedRuntimeRequest,
  code: "CONTENT_RUNTIME_INTERNAL" | "CONTENT_RUNTIME_RESPONSE_TOO_LARGE"
) {
  return {
    body: JSON.stringify({
      appLocale: request.appLocale,
      attemptId: request.attemptId,
      code,
      kind: "failure",
    }),
    status: 500,
  };
}

/** Resolves exact retained JSON without decoding it as current content. */
const resolveRuntime = Effect.fn("contentRelease.resolveRetainedRuntime")(
  function* (ctx: ActionCtx, request: StoredProtectedRuntimeRequest) {
    const row = yield* Effect.tryPromise({
      catch: () => new RetainedRuntimeReadError(),
      try: (): Promise<RetainedRuntimeBatchRow> =>
        ctx.runQuery(readReference, request),
    });
    if (!row) {
      return null;
    }
    const parsed = yield* Effect.all({
      artifacts: Effect.forEach(row.items, (item) =>
        Effect.try({
          catch: () => new RetainedRuntimeReadError(),
          try: (): unknown => JSON.parse(item.artifactJson),
        })
      ),
      release: Effect.try({
        catch: () => new RetainedRuntimeReadError(),
        try: (): unknown => JSON.parse(row.releaseJson),
      }),
      rendererManifest: Effect.try({
        catch: () => new RetainedRuntimeReadError(),
        try: (): unknown => JSON.parse(row.rendererJson),
      }),
    });
    const response = yield* Schema.decodeUnknown(
      StoredProtectedRuntimeResponseSchema,
      { onExcessProperty: "error" }
    )({
      appLocale: row.appLocale,
      attemptId: row.attemptId,
      items: row.items.map((item, index) => ({
        artifact: parsed.artifacts[index],
        delivery: item.delivery,
        sourcePath: item.sourcePath,
      })),
      kind: "found",
      release: parsed.release,
      rendererManifest: parsed.rendererManifest,
      snapshotId: row.snapshotId,
      snapshotManifestHash: row.snapshotManifestHash,
      snapshotReleaseId: row.snapshotReleaseId,
    }).pipe(Effect.mapError(() => new RetainedRuntimeReadError()));
    if (response.kind !== "found") {
      return yield* new RetainedRuntimeReadError();
    }
    return response;
  }
);

/** Decodes, resolves, and safely encodes one retained-history request. */
export const dispatchProgram = Effect.fn(
  "contentRelease.retainedRuntimeDispatch"
)(function* (ctx: ActionCtx, source: string, byteLength: number) {
  const decoded = yield* decodeRequest(source, byteLength).pipe(Effect.either);
  if (Either.isLeft(decoded)) {
    return failureResult("CONTENT_RUNTIME_INVALID", 400);
  }
  const resolved = yield* resolveRuntime(ctx, decoded.right).pipe(
    Effect.either
  );
  if (Either.isLeft(resolved)) {
    return encodeRetainedResult(
      decoded.right,
      { code: "CONTENT_RUNTIME_INTERNAL", kind: "failure" },
      500
    );
  }
  if (resolved.right === null) {
    return encodeRetainedResult(decoded.right, { kind: "missing" }, 404);
  }
  return encodeRetainedResult(decoded.right, resolved.right, 200);
});

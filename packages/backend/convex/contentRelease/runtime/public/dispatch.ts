import {
  CorpusSourcePathSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  decodePublicContentRuntimeRequest,
  MAX_PUBLIC_RUNTIME_REQUEST_BYTES,
  MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
  type PublicContentRuntimeFound,
  type PublicContentRuntimeRequest,
  PublicContentRuntimeResponseSchema,
} from "@nakafa/aksara-contracts/runtime/spec";
import {
  MAX_PUBLIC_RUNTIME_RESPONSE_BYTES as MAX_PREDECESSOR_PUBLIC_RUNTIME_RESPONSE_BYTES,
  PublicContentRuntimeResponseSchema as predecessorPublicContentRuntimeResponseSchema,
} from "@nakafa/aksara-v150/runtime/spec";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import {
  decodeArtifactJson,
  decodeProjectionJson,
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import type { PublicRuntimeRow } from "@repo/backend/convex/contentRelease/runtime/public/internal";
import { makePredecessorRuntime } from "@repo/backend/convex/contentRelease/runtime/public/predecessor";
import { encodePublicProjection } from "@repo/backend/convex/contentRelease/runtime/public/projection";
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
/** Convex or stored public runtime data failed before a safe response. */
class PublicRuntimeReadError extends Schema.TaggedError<PublicRuntimeReadError>()(
  "PublicRuntimeReadError",
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
/** Decodes one stored row into the exact Aksara public response. */
export const decodePublicRuntimeRow = Effect.fn(
  "contentRelease.decodePublicRuntimeRow"
)(function* (row: PublicRuntimeRow) {
  if (row === null) {
    return null;
  }
  if (row.delivery !== "public") {
    return yield* new PublicRuntimeReadError();
  }
  const [artifact, storedProjection, release, rendererManifest, sourcePath] =
    yield* Effect.all([
    decodeArtifactJson(row.artifactJson),
    decodeProjectionJson(row.projectionJson),
    decodeReleaseJson(row.releaseJson),
    decodeRendererJson(row.rendererJson),
    Schema.decodeEffect(CorpusSourcePathSchema)(row.sourcePath),
  ]).pipe(Effect.mapError(() => new PublicRuntimeReadError()));
  yield* Schema.decodeEffect(Sha256HashSchema)(row.projectionHash).pipe(
    Effect.mapError(() => new PublicRuntimeReadError())
  );
  const { projection, projectionJson } = yield* encodePublicProjection(
    storedProjection
  ).pipe(Effect.mapError(() => new PublicRuntimeReadError()));
  const projectionHash = yield* hashText(
    "the current public content projection",
    projectionJson
  ).pipe(Effect.mapError(() => new PublicRuntimeReadError()));
  if (projection.kind === "question-body") {
    return yield* new PublicRuntimeReadError();
  }
  if (
    row.activeManifestHash !== release.manifestHash ||
    row.activeReleaseId !== release.manifest.releaseId
  ) {
    return yield* new PublicRuntimeReadError();
  }
  const response: PublicContentRuntimeFound = {
    activeManifestHash: release.manifestHash,
    activeReleaseId: release.manifest.releaseId,
    artifact,
    delivery: "public",
    kind: "found",
    projection,
    projectionHash,
    release,
    rendererManifest,
    sourcePath,
  };
  return response;
});
/** Derives the exact 0.15.0 view after validating the stored current row. */
export const decodePredecessorRuntimeRow = Effect.fn(
  "contentRelease.decodePredecessorRuntimeRow"
)(function* (row: PublicRuntimeRow) {
  const current = yield* decodePublicRuntimeRow(row);
  if (current === null) {
    return null;
  }
  return yield* makePredecessorRuntime(current).pipe(
    Effect.mapError(() => new PublicRuntimeReadError())
  );
});

type RuntimeRowDecoder<Found> = (
  row: PublicRuntimeRow
) => Effect.Effect<Found | null, PublicRuntimeReadError>;
/** Reads one active public artifact for Nakafa verification. */
const resolvePublicRuntime = Effect.fn("contentRelease.resolvePublicRuntime")(
  function* <Found>(
    ctx: ActionCtx,
    request: PublicContentRuntimeRequest,
    decodeRow: RuntimeRowDecoder<Found>
  ) {
    const row = yield* Effect.tryPromise({
      catch: () => new PublicRuntimeReadError(),
      try: (): Promise<PublicRuntimeRow> =>
        ctx.runQuery(publicReadReference, {
          appLocale: request.appLocale,
          publicPath: request.publicPath,
        }),
    });
    return yield* decodeRow(row);
  }
);
/** Decodes, resolves, and safely encodes one public runtime request. */
const dispatchRuntimeProgram = Effect.fn(
  "contentRelease.dispatchPublicRuntime"
)(function* <Found, A, I>(
  ctx: ActionCtx,
  source: string,
  byteLength: number,
  decodeRow: RuntimeRowDecoder<Found>,
  responseSchema: Schema.Codec<A, I, never, never>,
  maxResponseBytes: number
) {
  const decoded = yield* decodePublicRequest(source, byteLength).pipe(
    Effect.result
  );
  if (Result.isFailure(decoded)) {
    return failureResult("CONTENT_RUNTIME_INVALID", 400);
  }
  const resolved = yield* resolvePublicRuntime(
    ctx,
    decoded.success,
    decodeRow
  ).pipe(Effect.result);
  if (Result.isFailure(resolved)) {
    return failureResult("CONTENT_RUNTIME_INTERNAL", 500);
  }
  if (resolved.success === null) {
    return encodeRuntimeResult(
      responseSchema,
      maxResponseBytes,
      { kind: "missing" },
      404
    );
  }
  return encodeRuntimeResult(
    responseSchema,
    maxResponseBytes,
    resolved.success,
    200
  );
});

/** Serves the versioned current public runtime contract. */
export const dispatchProgram = Effect.fn(
  "contentRelease.publicRuntimeDispatch"
)(function* (ctx: ActionCtx, source: string, byteLength: number) {
  return yield* dispatchRuntimeProgram(
    ctx,
    source,
    byteLength,
    decodePublicRuntimeRow,
    PublicContentRuntimeResponseSchema,
    MAX_PUBLIC_RUNTIME_RESPONSE_BYTES
  );
});

/** Serves the bounded 0.15.0 predecessor runtime contract. */
export const dispatchPredecessorProgram = Effect.fn(
  "contentRelease.predecessorPublicRuntimeDispatch"
)(function* (ctx: ActionCtx, source: string, byteLength: number) {
  return yield* dispatchRuntimeProgram(
    ctx,
    source,
    byteLength,
    decodePredecessorRuntimeRow,
    predecessorPublicContentRuntimeResponseSchema,
    MAX_PREDECESSOR_PUBLIC_RUNTIME_RESPONSE_BYTES
  );
});

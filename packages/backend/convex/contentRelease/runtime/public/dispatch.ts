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
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  decodeArtifactJson,
  decodeProjectionJson,
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import type { PublicRuntimeRow } from "@repo/backend/convex/contentRelease/runtime/public/internal";
import {
  encodeRuntimeResult,
  failureResult,
} from "@repo/backend/convex/contentRelease/runtime/result";
import { makeFunctionReference } from "convex/server";
import { Effect, Either, Schema } from "effect";

const publicReadReference = makeFunctionReference<
  "query",
  Pick<PublicContentRuntimeRequest, "locale" | "publicPath">,
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

/** Reads one active public artifact for Nakafa verification. */
const resolvePublicRuntime = Effect.fn("contentRelease.resolvePublicRuntime")(
  function* (ctx: ActionCtx, request: PublicContentRuntimeRequest) {
    const row = yield* Effect.tryPromise({
      catch: () => new PublicRuntimeReadError(),
      try: (): Promise<PublicRuntimeRow> =>
        ctx.runQuery(publicReadReference, {
          locale: request.locale,
          publicPath: request.publicPath,
        }),
    });
    if (row === null) {
      return null;
    }
    if (row.delivery !== "public") {
      return yield* new PublicRuntimeReadError();
    }
    const [
      artifact,
      projection,
      projectionHash,
      release,
      rendererManifest,
      sourcePath,
    ] = yield* Effect.all([
      decodeArtifactJson(row.artifactJson),
      decodeProjectionJson(row.projectionJson),
      Schema.decodeUnknown(Sha256HashSchema)(row.projectionHash),
      decodeReleaseJson(row.releaseJson),
      decodeRendererJson(row.rendererJson),
      Schema.decodeUnknown(CorpusSourcePathSchema)(row.sourcePath),
    ]).pipe(Effect.mapError(() => new PublicRuntimeReadError()));
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
  }
);

/** Decodes, resolves, and safely encodes one public runtime request. */
export const dispatchProgram = Effect.fn(
  "contentRelease.publicRuntimeDispatch"
)(function* (ctx: ActionCtx, source: string, byteLength: number) {
  const decoded = yield* decodePublicRequest(source, byteLength).pipe(
    Effect.either
  );
  if (Either.isLeft(decoded)) {
    return failureResult("CONTENT_RUNTIME_INVALID", 400);
  }
  const resolved = yield* resolvePublicRuntime(ctx, decoded.right).pipe(
    Effect.either
  );
  if (Either.isLeft(resolved)) {
    return failureResult("CONTENT_RUNTIME_INTERNAL", 500);
  }
  if (resolved.right === null) {
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
    resolved.right,
    200
  );
});

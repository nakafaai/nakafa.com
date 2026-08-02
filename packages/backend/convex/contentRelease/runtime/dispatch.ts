"use node";

import { CorpusSourcePathSchema } from "@nakafa/aksara-contracts/ids";
import { hashContentProjection } from "@nakafa/aksara-contracts/projection/hash";
import {
  type ContentRuntimeRequest,
  decodeContentRuntimeRequest,
  MAX_RUNTIME_REQUEST_BYTES,
  type ProtectedContentRuntimeFound,
  type ProtectedContentRuntimeRequest,
  type PublicContentRuntimeFound,
  type PublicContentRuntimeRequest,
} from "@nakafa/aksara-contracts/runtime/spec";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { verifyContentEnvelope } from "@repo/backend/content/verify";
import {
  type ActionCtx,
  internalAction,
} from "@repo/backend/convex/_generated/server";
import {
  decodeArtifactJson,
  decodeProjectionJson,
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import type { RuntimeRow } from "@repo/backend/convex/contentRelease/runtime";
import type { ProtectedRuntimeRow } from "@repo/backend/convex/contentRelease/runtime/protected";
import {
  encodeRuntimeResult,
  failureResult,
} from "@repo/backend/convex/contentRelease/runtime/result";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { Effect, Either, Schema } from "effect";

type PublicRuntimeReadArgs = Pick<
  PublicContentRuntimeRequest,
  "locale" | "publicPath"
>;

const publicReadReference = makeFunctionReference<
  "query",
  PublicRuntimeReadArgs,
  RuntimeRow
>("contentRelease/runtime:readPublic");

const protectedReadReference = makeFunctionReference<
  "query",
  ProtectedContentRuntimeRequest,
  ProtectedRuntimeRow
>("contentRelease/runtime/protected:readProtected");

/** Request JSON could not satisfy the exact shared runtime contract. */
class RuntimeRequestError extends Schema.TaggedError<RuntimeRequestError>()(
  "RuntimeRequestError",
  {}
) {}

/** Convex or stored runtime data failed before a safe response was built. */
class RuntimeReadError extends Schema.TaggedError<RuntimeReadError>()(
  "RuntimeReadError",
  {}
) {}

/** Strictly parses one bounded UTF-8 request through the shared schema. */
const decodeRuntimeRequest = Effect.fn("contentRelease.decodeRuntimeRequest")(
  function* (source: string, byteLength: number) {
    const measured = new TextEncoder().encode(source).byteLength;
    if (byteLength !== measured || measured > MAX_RUNTIME_REQUEST_BYTES) {
      return yield* new RuntimeRequestError();
    }
    const input = yield* Effect.try({
      catch: () => new RuntimeRequestError(),
      try: (): unknown => JSON.parse(source),
    });
    return yield* decodeContentRuntimeRequest(input).pipe(
      Effect.mapError(() => new RuntimeRequestError())
    );
  }
);

/** Reads and verifies one active public artifact. */
const resolvePublicRuntime = Effect.fn("contentRelease.resolvePublicRuntime")(
  function* (ctx: ActionCtx, request: PublicContentRuntimeRequest) {
    const row = yield* Effect.tryPromise({
      catch: () => new RuntimeReadError(),
      try: (): Promise<RuntimeRow> =>
        ctx.runQuery(publicReadReference, {
          locale: request.locale,
          publicPath: request.publicPath,
        }),
    });
    if (row === null) {
      return null;
    }
    if (row.delivery !== "public") {
      return yield* new RuntimeReadError();
    }
    const [artifact, projection, release, rendererManifest, sourcePath] =
      yield* Effect.all([
        decodeArtifactJson(row.artifactJson),
        decodeProjectionJson(row.projectionJson),
        decodeReleaseJson(row.releaseJson),
        decodeRendererJson(row.rendererJson),
        Schema.decodeUnknown(CorpusSourcePathSchema)(row.sourcePath),
      ]).pipe(Effect.mapError(() => new RuntimeReadError()));
    if (projection.kind === "question-body") {
      return yield* new RuntimeReadError();
    }
    const projectionHash = hashContentProjection(projection);
    if (
      row.activeManifestHash !== release.manifestHash ||
      row.activeReleaseId !== release.manifest.releaseId ||
      row.projectionHash !== projectionHash
    ) {
      return yield* new RuntimeReadError();
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
    yield* verifyContentEnvelope({ request, response }).pipe(
      Effect.mapError(() => new RuntimeReadError())
    );
    return response;
  }
);

/** Reads and verifies one protected artifact from a retained snapshot. */
const resolveProtectedRuntime = Effect.fn(
  "contentRelease.resolveProtectedRuntime"
)(function* (ctx: ActionCtx, request: ProtectedContentRuntimeRequest) {
  const row = yield* Effect.tryPromise({
    catch: () => new RuntimeReadError(),
    try: (): Promise<ProtectedRuntimeRow> =>
      ctx.runQuery(protectedReadReference, request),
  });
  if (row === null) {
    return null;
  }
  const [artifact, release, rendererManifest, sourcePath] = yield* Effect.all([
    decodeArtifactJson(row.artifactJson),
    decodeReleaseJson(row.releaseJson),
    decodeRendererJson(row.rendererJson),
    Schema.decodeUnknown(CorpusSourcePathSchema)(row.sourcePath),
  ]).pipe(Effect.mapError(() => new RuntimeReadError()));
  if (
    row.activeManifestHash !== release.manifestHash ||
    row.activeReleaseId !== release.manifest.releaseId ||
    row.delivery !== request.delivery ||
    row.snapshotId !== request.snapshotId
  ) {
    return yield* new RuntimeReadError();
  }
  const response: ProtectedContentRuntimeFound = {
    activeManifestHash: release.manifestHash,
    activeReleaseId: release.manifest.releaseId,
    artifact,
    delivery: row.delivery,
    kind: "found",
    release,
    rendererManifest,
    snapshotId: request.snapshotId,
    sourcePath,
  };
  yield* verifyContentEnvelope({ request, response }).pipe(
    Effect.mapError(() => new RuntimeReadError())
  );
  return response;
});

/** Routes one decoded request to its delivery-owned storage read. */
const resolveRuntime = Effect.fn("contentRelease.resolveRuntime")(function* (
  ctx: ActionCtx,
  request: ContentRuntimeRequest
) {
  if (request.delivery === "public") {
    return yield* resolvePublicRuntime(ctx, request);
  }

  return yield* resolveProtectedRuntime(ctx, request);
});

/** Authenticates, decodes, authorizes, and reads one server-only artifact. */
export const dispatchProgram = Effect.fn("contentRelease.runtimeDispatch")(
  function* (ctx: ActionCtx, source: string, byteLength: number) {
    const decoded = yield* decodeRuntimeRequest(source, byteLength).pipe(
      Effect.either
    );
    if (Either.isLeft(decoded)) {
      return failureResult("CONTENT_RUNTIME_INVALID", 400);
    }

    const resolved = yield* resolveRuntime(ctx, decoded.right).pipe(
      Effect.either
    );
    if (Either.isLeft(resolved)) {
      return failureResult("CONTENT_RUNTIME_INTERNAL", 500);
    }
    if (resolved.right === null) {
      return encodeRuntimeResult({ kind: "missing" }, 404);
    }
    return encodeRuntimeResult(resolved.right, 200);
  }
);

/** Node action verifying one bounded executable-content runtime request. */
export const dispatch = internalAction({
  args: { byteLength: v.number(), source: v.string() },
  returns: v.object({ body: v.string(), status: v.number() }),
  handler: (ctx, args) =>
    runConvexProgram(
      dispatchProgram(ctx, args.source, args.byteLength).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        )
      )
    ),
});

"use node";

import { CorpusSourcePathSchema } from "@nakafa/aksara-contracts/ids";
import { hashContentProjection } from "@nakafa/aksara-contracts/projection/hash";
import { isQuestionProjection } from "@nakafa/aksara-contracts/projection/spec";
import { verifySignedContentRelease } from "@nakafa/aksara-contracts/release/verify";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import {
  type ContentRuntimeFound,
  type ContentRuntimeRequest,
  decodeContentRuntimeRequest,
  MAX_RUNTIME_REQUEST_BYTES,
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
import {
  encodeRuntimeResult,
  failureResult,
  internalResult,
} from "@repo/backend/convex/contentRelease/runtime/result";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { Effect, Either, Schema } from "effect";

type RuntimeReadArgs = Pick<ContentRuntimeRequest, "locale" | "publicPath">;

const publicReadReference = makeFunctionReference<
  "query",
  RuntimeReadArgs,
  RuntimeRow
>("contentRelease/runtime:readPublic");

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

/** Calls the sole public artifact read behind the server-authenticated route. */
const readRuntime = Effect.fn("contentRelease.readRuntime")(function* (
  ctx: ActionCtx,
  request: ContentRuntimeRequest
) {
  const args = { locale: request.locale, publicPath: request.publicPath };
  return yield* Effect.tryPromise({
    catch: () => new RuntimeReadError(),
    try: (): Promise<RuntimeRow> => ctx.runQuery(publicReadReference, args),
  });
});

/** Decodes and binds one internal row to its exact initiating request. */
const verifyRuntimeFound = Effect.fn("contentRelease.verifyRuntimeFound")(
  function* (request: ContentRuntimeRequest, row: Exclude<RuntimeRow, null>) {
    const [artifact, projection, storedRelease, storedRenderer, sourcePath] =
      yield* Effect.all([
        decodeArtifactJson(row.artifactJson),
        decodeProjectionJson(row.projectionJson),
        decodeReleaseJson(row.releaseJson),
        decodeRendererJson(row.rendererJson),
        Schema.decodeUnknown(CorpusSourcePathSchema)(row.sourcePath),
      ]).pipe(Effect.mapError(() => new RuntimeReadError()));
    const [release, renderer] = yield* Effect.all([
      verifySignedContentRelease(storedRelease),
      validateRendererManifestHash(storedRenderer),
    ]).pipe(Effect.mapError(() => new RuntimeReadError()));
    const projectionHash = hashContentProjection(projection);
    if (
      isQuestionProjection(projection) ||
      release.manifest.releaseId !== row.activeReleaseId ||
      release.manifestHash !== row.activeManifestHash ||
      release.manifest.rendererManifestHash !== renderer.hash ||
      projectionHash !== row.projectionHash
    ) {
      return yield* new RuntimeReadError();
    }
    const response: ContentRuntimeFound = {
      activeManifestHash: release.manifestHash,
      activeReleaseId: release.manifest.releaseId,
      artifact,
      delivery: row.delivery,
      kind: "found",
      projection,
      projectionHash,
      release,
      rendererManifest: renderer,
      sourcePath,
    };
    return yield* verifyContentEnvelope({
      request,
      response,
    }).pipe(Effect.mapError(() => new RuntimeReadError()));
  }
);

/** Authenticates, decodes, authorizes, and reads one server-only artifact. */
export const dispatchProgram = Effect.fn("contentRelease.runtimeDispatch")(
  function* (ctx: ActionCtx, source: string, byteLength: number) {
    const decoded = yield* decodeRuntimeRequest(source, byteLength).pipe(
      Effect.either
    );
    if (Either.isLeft(decoded)) {
      return failureResult("CONTENT_RUNTIME_INVALID", 400);
    }
    if (decoded.right.delivery !== "public") {
      return failureResult("CONTENT_RUNTIME_INVALID", 400);
    }
    const row = yield* readRuntime(ctx, decoded.right).pipe(Effect.either);
    if (Either.isLeft(row)) {
      return failureResult("CONTENT_RUNTIME_INTERNAL", 500);
    }
    if (row.right === null) {
      return encodeRuntimeResult({ kind: "missing" }, 404);
    }
    const found = yield* verifyRuntimeFound(decoded.right, row.right).pipe(
      Effect.either
    );
    if (Either.isLeft(found)) {
      return internalResult();
    }
    return encodeRuntimeResult(found.right, 200);
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

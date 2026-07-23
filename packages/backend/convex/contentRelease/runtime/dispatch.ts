"use node";

import { CorpusSourcePathSchema } from "@nakafa/aksara-contracts/ids";
import { hashMaterialProjection } from "@nakafa/aksara-contracts/projection/hash";
import { verifySignedContentRelease } from "@nakafa/aksara-contracts/release/verify";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import {
  type ContentRuntimeFound,
  type ContentRuntimeRequest,
  decodeContentRuntimeRequest,
  MAX_RUNTIME_REQUEST_BYTES,
} from "@nakafa/aksara-contracts/runtime/spec";
import { verifyContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/verify";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
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
import { trustedKeyResolver } from "@repo/backend/convex/contentRelease/proof/trust";
import type { RuntimeRow } from "@repo/backend/convex/contentRelease/runtime";
import {
  encodeRuntimeResult,
  failureResult,
  internalResult,
} from "@repo/backend/convex/contentRelease/runtime/result";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuthForAction } from "@repo/backend/convex/lib/helpers/auth";
import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { Effect, Either, Schema } from "effect";

type RuntimeAuth = Awaited<ReturnType<typeof requireAuthForAction>>;

type RuntimeReadArgs = Pick<ContentRuntimeRequest, "locale" | "publicPath">;

const publicReadReference = makeFunctionReference<
  "query",
  RuntimeReadArgs,
  RuntimeRow
>("contentRelease/runtime:readPublic");
const authenticatedReadReference = makeFunctionReference<
  "query",
  RuntimeReadArgs,
  RuntimeRow
>("contentRelease/runtime:readAuthenticated");
const entitledReadReference = makeFunctionReference<
  "query",
  RuntimeReadArgs,
  RuntimeRow
>("contentRelease/runtime:readEntitled");

/** Request JSON could not satisfy the exact shared runtime contract. */
class RuntimeRequestError extends Schema.TaggedError<RuntimeRequestError>()(
  "RuntimeRequestError",
  {}
) {}

/** User authentication or entitlement rejected one runtime request. */
class RuntimeAccessError extends Schema.TaggedError<RuntimeAccessError>()(
  "RuntimeAccessError",
  { reason: Schema.Literal("forbidden", "unauthorized") }
) {}

/** Convex or stored runtime data failed before a safe response was built. */
class RuntimeReadError extends Schema.TaggedError<RuntimeReadError>()(
  "RuntimeReadError",
  {}
) {}

/** Distinguishes expected auth rejection from infrastructure failures. */
function runtimeAuthError(error: unknown) {
  if (error instanceof ConvexError) {
    if (error.data === "Unauthenticated") {
      return new RuntimeAccessError({ reason: "unauthorized" });
    }
    const data = error.data;
    if (
      typeof data === "object" &&
      data !== null &&
      "code" in data &&
      data.code === "UNAUTHORIZED"
    ) {
      return new RuntimeAccessError({ reason: "unauthorized" });
    }
  }
  return new RuntimeReadError();
}

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

/** Enforces Better Auth and plan access for one requested delivery class. */
const authorizeRuntime = Effect.fn("contentRelease.authorizeRuntime")(
  function* (ctx: ActionCtx, delivery: ContentRuntimeRequest["delivery"]) {
    if (delivery === "public") {
      return;
    }
    const auth: RuntimeAuth = yield* Effect.tryPromise({
      catch: runtimeAuthError,
      try: () => requireAuthForAction(ctx),
    });
    if (delivery === "entitled" && auth.appUser.plan !== "pro") {
      return yield* new RuntimeAccessError({ reason: "forbidden" });
    }
  }
);

/** Calls the one internal read selected by the delivery contract. */
const readRuntime = Effect.fn("contentRelease.readRuntime")(function* (
  ctx: ActionCtx,
  request: ContentRuntimeRequest
) {
  const args = { locale: request.locale, publicPath: request.publicPath };
  return yield* Effect.tryPromise({
    catch: () => new RuntimeReadError(),
    try: (): Promise<RuntimeRow> => {
      if (request.delivery === "public") {
        return ctx.runQuery(publicReadReference, args);
      }
      if (request.delivery === "authenticated") {
        return ctx.runQuery(authenticatedReadReference, args);
      }
      return ctx.runQuery(entitledReadReference, args);
    },
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
    const projectionHash = hashMaterialProjection(projection);
    if (
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
    return yield* verifyContentRuntimeExchange({
      rendererManifest: renderer,
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
    const access = yield* authorizeRuntime(ctx, decoded.right.delivery).pipe(
      Effect.either
    );
    if (Either.isLeft(access)) {
      if (access.left._tag === "RuntimeReadError") {
        return failureResult("CONTENT_RUNTIME_INTERNAL", 500);
      }
      if (access.left.reason === "forbidden") {
        return failureResult("CONTENT_RUNTIME_FORBIDDEN", 403);
      }
      return failureResult("CONTENT_RUNTIME_UNAUTHORIZED", 401);
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
          trustedKeyResolver
        )
      )
    ),
});

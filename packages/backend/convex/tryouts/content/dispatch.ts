"use node";

import { verifySignedContentArtifactIntegrity } from "@nakafa/aksara-contracts/artifact/integrity";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import {
  decodeTryoutContentRequest,
  MAX_TRYOUT_CONTENT_REQUEST_BYTES,
} from "@repo/backend/content/tryout";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  type ActionCtx,
  internalAction,
} from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  encodeTryoutContentResult,
  internalTryoutContentResult,
  type TryoutContentHttpResult,
  tryoutContentFailure,
} from "@repo/backend/convex/tryouts/content/result";
import type {
  TryoutContentReadArgs,
  TryoutContentReadResult,
} from "@repo/backend/convex/tryouts/content/spec";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { Effect, Either, Schema } from "effect";

const readReference = makeFunctionReference<
  "query",
  TryoutContentReadArgs,
  TryoutContentReadResult
>("tryouts/content/read:read");

/** Request bytes could not satisfy the exact private route contract. */
class TryoutContentRequestError extends Schema.TaggedError<TryoutContentRequestError>()(
  "TryoutContentRequestError",
  {}
) {}

/** Stored content could not be read or cryptographically authenticated. */
class TryoutContentDispatchError extends Schema.TaggedError<TryoutContentDispatchError>()(
  "TryoutContentDispatchError",
  {}
) {}

/** Strictly parses one bounded UTF-8 request through the shared schema. */
const decodeRequest = Effect.fn("tryouts.decodeContentRequest")(function* (
  source: string,
  byteLength: number
) {
  const measured = new TextEncoder().encode(source).byteLength;
  if (byteLength !== measured || measured > MAX_TRYOUT_CONTENT_REQUEST_BYTES) {
    return yield* new TryoutContentRequestError();
  }
  const input = yield* Effect.try({
    catch: () => new TryoutContentRequestError(),
    try: (): unknown => JSON.parse(source),
  });
  return yield* decodeTryoutContentRequest(input).pipe(
    Effect.mapError(() => new TryoutContentRequestError())
  );
});

/** Reads the authenticated user's route without accepting caller-owned IDs. */
const readContent = Effect.fn("tryouts.readContentDispatch")(function* (
  ctx: ActionCtx,
  userId: Id<"users">,
  source: string,
  byteLength: number
) {
  const request = yield* decodeRequest(source, byteLength);
  const row = yield* Effect.tryPromise({
    catch: () => new TryoutContentDispatchError(),
    try: (): Promise<TryoutContentReadResult> =>
      ctx.runQuery(readReference, { ...request, userId }),
  });

  return { request, row };
});

/** Authenticates one stored signed envelope before it leaves Convex. */
const verifyArtifact = Effect.fn("tryouts.verifyContentArtifact")(
  (artifactJson: string) =>
    Effect.try({
      catch: () => new TryoutContentDispatchError(),
      try: (): unknown => JSON.parse(artifactJson),
    }).pipe(
      Effect.flatMap(verifySignedContentArtifactIntegrity),
      Effect.mapError(() => new TryoutContentDispatchError())
    )
);

/** Verifies every ordered placement envelope in one bounded section. */
const verifyContent = Effect.fn("tryouts.verifyContentDispatch")(function* (
  row: Exclude<TryoutContentReadResult, null>
) {
  const artifacts = yield* Effect.forEach(row.artifacts, (entry) =>
    Effect.gen(function* () {
      const questionArtifact = yield* verifyArtifact(
        entry.questionArtifactJson
      );
      if (!entry.answerArtifactJson) {
        return {
          placementId: entry.placementId,
          questionArtifact,
        };
      }
      const answerArtifact = yield* verifyArtifact(entry.answerArtifactJson);
      return {
        answerArtifact,
        placementId: entry.placementId,
        questionArtifact,
      };
    })
  );

  return { artifacts, kind: "found" } as const;
});

/** Authenticates and returns one user's frozen try-out content section. */
export const dispatchProgram = Effect.fn("tryouts.contentDispatch")(function* (
  ctx: ActionCtx,
  source: string,
  byteLength: number,
  userId: Id<"users">
) {
  const decoded = yield* readContent(ctx, userId, source, byteLength).pipe(
    Effect.either
  );
  if (Either.isLeft(decoded)) {
    return decoded.left._tag === "TryoutContentRequestError"
      ? tryoutContentFailure("TRYOUT_CONTENT_INVALID", 400)
      : internalTryoutContentResult();
  }
  if (decoded.right.row === null) {
    return encodeTryoutContentResult({ kind: "unavailable" }, 200);
  }

  const verified = yield* verifyContent(decoded.right.row).pipe(Effect.either);
  if (Either.isLeft(verified)) {
    return internalTryoutContentResult();
  }
  return encodeTryoutContentResult(verified.right, 200);
});

/** Node action verifying one authenticated try-out content request. */
export const dispatch = internalAction({
  args: {
    byteLength: v.number(),
    source: v.string(),
    userId: v.id("users"),
  },
  returns: v.object({ body: v.string(), status: v.number() }),
  handler: (ctx, args): Promise<TryoutContentHttpResult> =>
    runConvexProgram(
      dispatchProgram(ctx, args.source, args.byteLength, args.userId).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        )
      )
    ),
});

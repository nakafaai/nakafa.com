"use node";

import type { ReleaseId } from "@nakafa/aksara-contracts/ids";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { ACTIVE_SIGNING_KEY_ID } from "@nakafa/aksara-contracts/signature/trusted";
import type { PublicationRequest } from "@nakafa/aksara-contracts/transport/request";
import { contentKeyResolver } from "@repo/backend/content/trust";
import {
  type ActionCtx,
  internalAction,
} from "@repo/backend/convex/_generated/server";
import type { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { readCurrentPublication } from "@repo/backend/convex/contentRelease/ingress/current";
import { decodePublicationBody } from "@repo/backend/convex/contentRelease/ingress/decode";
import {
  predecodeFailure,
  requestFailure,
} from "@repo/backend/convex/contentRelease/ingress/failure";
import { advancePublication } from "@repo/backend/convex/contentRelease/ingress/lifecycle";
import { readPublication } from "@repo/backend/convex/contentRelease/ingress/read";
import {
  publicationFailure,
  publicationSuccess,
} from "@repo/backend/convex/contentRelease/ingress/response";
import { stagePublication } from "@repo/backend/convex/contentRelease/ingress/stage";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { type Infer, v } from "convex/values";
import { Effect, Either } from "effect";

const dispatchInputValidator = v.object({
  byteLength: v.number(),
  source: v.string(),
});

/** Complete bounded evidence accepted by the Node publication dispatcher. */
export type DispatchInput = Infer<typeof dispatchInputValidator>;

/** Routes one decoded request to its single domain-owned capability. */
const performRequest = Effect.fn("contentRelease.performRequest")(function* (
  ctx: ActionCtx,
  request: PublicationRequest,
  activeKeyId: string
) {
  if (
    request.operation === "stageRelease" ||
    request.operation === "stageRecovery" ||
    request.operation === "stageItemBatch" ||
    request.operation === "stageRouteBatch" ||
    request.operation === "stageProjectionBatch" ||
    request.operation === "stageArtifactBatch" ||
    request.operation === "stageSnapshot" ||
    request.operation === "stageSnapshotBatch"
  ) {
    return yield* stagePublication(ctx, request, activeKeyId);
  }
  if (
    request.operation === "accept" ||
    request.operation === "abort" ||
    request.operation === "verify" ||
    request.operation === "activate" ||
    request.operation === "activateRecovery"
  ) {
    return yield* advancePublication(ctx, request);
  }
  return yield* readPublication(ctx, request);
});

/** Encodes one sanitized failure from a fully decoded request. */
const encodeRequestFailure = Effect.fn("contentRelease.encodeRequestFailure")(
  function* (ctx: ActionCtx, request: PublicationRequest, error: ReleaseError) {
    let activeReleaseId: null | ReleaseId = null;
    if (error.code === "CONTENT_RELEASE_STALE_BASE") {
      const current = yield* readCurrentPublication(ctx).pipe(Effect.either);
      if (Either.isLeft(current)) {
        const failure = yield* requestFailure(request, current.left, null);
        return yield* publicationFailure(failure);
      }
      activeReleaseId =
        current.right.active?.release.manifest.releaseId ?? null;
    }
    const failure = yield* requestFailure(request, error, activeReleaseId);
    return yield* publicationFailure(failure);
  }
);

/** Strictly decodes, executes, and sanitizes one authenticated request. */
export const dispatchPublication = Effect.fn(
  "contentRelease.dispatchPublication"
)(function* (
  ctx: ActionCtx,
  input: DispatchInput,
  activeKeyId = ACTIVE_SIGNING_KEY_ID
) {
  const decoded = yield* decodePublicationBody(
    input.source,
    input.byteLength
  ).pipe(Effect.either);
  if (Either.isLeft(decoded)) {
    return yield* publicationFailure(predecodeFailure(decoded.left));
  }
  return yield* performRequest(ctx, decoded.right, activeKeyId).pipe(
    Effect.flatMap((response) => publicationSuccess(response)),
    Effect.catchTag("ReleaseError", (error) =>
      encodeRequestFailure(ctx, decoded.right, error)
    )
  );
});

/** Runs the publication program with the reviewed production key registry. */
export function dispatchHandler(ctx: ActionCtx, input: DispatchInput) {
  return runConvexProgram(
    dispatchPublication(ctx, input).pipe(
      Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver)
    )
  );
}

/** Internal Node boundary used only by the bounded HTTP publication route. */
export const dispatch = internalAction({
  args: dispatchInputValidator,
  returns: v.object({ body: v.string(), status: v.number() }),
  handler: dispatchHandler,
});

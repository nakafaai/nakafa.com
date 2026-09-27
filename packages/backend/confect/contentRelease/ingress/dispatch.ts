"use node";

import type { ReleaseId } from "@nakafa/aksara-contracts/ids";
import type { PublicationRequest } from "@nakafa/aksara-contracts/transport/request";
import { ActionCtx as ActionCtxService } from "@repo/backend/confect/_generated/services";
import type { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { readCurrentPublication } from "@repo/backend/confect/contentRelease/ingress/current";
import { decodePublicationBody } from "@repo/backend/confect/contentRelease/ingress/decode";
import type { dispatchInputValidator } from "@repo/backend/confect/contentRelease/ingress/dispatch.spec";
import {
  predecodeFailure,
  requestFailure,
} from "@repo/backend/confect/contentRelease/ingress/failure";
import { stagePublicationGroup } from "@repo/backend/confect/contentRelease/ingress/group";
import { advancePublication } from "@repo/backend/confect/contentRelease/ingress/lifecycle";
import { readPublication } from "@repo/backend/confect/contentRelease/ingress/read";
import {
  publicationFailure,
  publicationSuccess,
} from "@repo/backend/confect/contentRelease/ingress/response";
import { stagePublication } from "@repo/backend/confect/contentRelease/ingress/stage";
import { activeContentSigningKeyId } from "@repo/backend/content/trust";
import { Effect, Result, type Schema } from "effect";
/** Complete bounded evidence accepted by the Node publication dispatcher. */
export type DispatchInput = Schema.Schema.Type<typeof dispatchInputValidator>;
/** Routes one decoded request to its single domain-owned capability. */
export const performRequest = Effect.fn("contentRelease.performRequest")(
  function* (request: PublicationRequest, activeKeyId: string) {
    const _ctx = yield* ActionCtxService;
    if (request.operation === "stageGroup") {
      return yield* stagePublicationGroup(request, activeKeyId);
    }
    if (
      request.operation === "stageRelease" ||
      request.operation === "stageRecovery" ||
      request.operation === "stageItemBatch" ||
      request.operation === "stageRouteBatch" ||
      request.operation === "stageProjectionBatch" ||
      request.operation === "stageArtifactBatch" ||
      request.operation === "stageSnapshot" ||
      request.operation === "stageSnapshotBatch" ||
      request.operation === "stageTryoutRuntimeBundle"
    ) {
      return yield* stagePublication(request, activeKeyId);
    }
    if (
      request.operation === "accept" ||
      request.operation === "abort" ||
      request.operation === "verify" ||
      request.operation === "activate" ||
      request.operation === "activateRecovery"
    ) {
      return yield* advancePublication(request);
    }
    return yield* readPublication(request);
  }
);
/** Encodes one sanitized failure from a fully decoded request. */
export const encodeRequestFailure = Effect.fn(
  "contentRelease.encodeRequestFailure"
)(function* (request: PublicationRequest, error: ReleaseError) {
  yield* Effect.logWarning("Content publication request rejected.").pipe(
    Effect.annotateLogs({
      code: error.code,
      operation: request.operation,
      reason: error.message,
    })
  );
  let activeReleaseId: null | ReleaseId = null;
  if (error.code === "CONTENT_RELEASE_STALE_BASE") {
    const current = yield* readCurrentPublication().pipe(Effect.result);
    if (Result.isFailure(current)) {
      const failure = yield* requestFailure(request, current.failure, null);
      return yield* publicationFailure(failure);
    }
    activeReleaseId =
      current.success.active?.release.manifest.releaseId ?? null;
  }
  const failure = yield* requestFailure(request, error, activeReleaseId);
  return yield* publicationFailure(failure);
});
/** Strictly decodes, executes, and sanitizes one authenticated request. */
export const dispatchPublication = Effect.fn(
  "contentRelease.dispatchPublication"
)(function* (input: DispatchInput, activeKeyId = activeContentSigningKeyId) {
  const decoded = yield* decodePublicationBody(
    input.source,
    input.byteLength
  ).pipe(Effect.result);
  if (Result.isFailure(decoded)) {
    return yield* publicationFailure(predecodeFailure(decoded.failure));
  }
  return yield* performRequest(decoded.success, activeKeyId).pipe(
    Effect.flatMap((response) => publicationSuccess(response)),
    Effect.catchTag("ReleaseError", (error) =>
      encodeRequestFailure(decoded.success, error)
    )
  );
});

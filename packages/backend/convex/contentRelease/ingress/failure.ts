import type { ReleaseId } from "@nakafa/aksara-contracts/ids";
import type { PublicationFailure } from "@nakafa/aksara-contracts/transport/failure";
import type { PublicationRequest } from "@nakafa/aksara-contracts/transport/request";
import type { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { Effect, Schema } from "effect";

/** Marks an impossible request/error pairing as an internal programming defect. */
export class PublicationFailureDefect extends Schema.TaggedError<PublicationFailureDefect>()(
  "PublicationFailureDefect",
  { code: Schema.String, operation: Schema.String }
) {}

/** Returns the release identity owned by one fully decoded request. */
export function requestReleaseId(
  request: Exclude<PublicationRequest, { readonly operation: "current" }>
): ReleaseId;
/** Preserves the nullable identity of the current-release read operation. */
export function requestReleaseId(request: PublicationRequest): null | ReleaseId;
/** Selects the stable release identity encoded by each publication operation. */
export function requestReleaseId(request: PublicationRequest) {
  if (request.operation === "current") {
    return null;
  }
  if (request.operation === "headPage") {
    return request.activeReleaseId;
  }
  if (request.operation === "recovery") {
    return request.recoveryId;
  }
  if (
    request.operation === "stageRelease" ||
    request.operation === "stageRecovery" ||
    request.operation === "verify" ||
    request.operation === "activate" ||
    request.operation === "activateRecovery"
  ) {
    return request.release.manifest.releaseId;
  }
  if (
    request.operation === "rollbackPage" ||
    request.operation === "routePage"
  ) {
    return request.rollbackOf;
  }
  return request.releaseId;
}

/** Sanitizes a failure raised before a publication operation was decoded. */
export function predecodeFailure(error: ReleaseError): PublicationFailure {
  switch (error.code) {
    case "CONTENT_RELEASE_UNAUTHORIZED":
      return { code: error.code, kind: "unauthorized" };
    case "CONTENT_RELEASE_SIZE":
    case "CONTENT_RELEASE_UNSUPPORTED":
      return {
        code: error.code,
        kind: "rejected",
        operation: null,
        releaseId: null,
      };
    default:
      return {
        code: "CONTENT_RELEASE_INVALID_REQUEST",
        kind: "rejected",
        operation: null,
        releaseId: null,
      };
  }
}

/** Builds the exact immutable-conflict shape owned by one request operation. */
function conflictFailure(
  request: PublicationRequest
): PublicationFailure | null {
  if (
    request.operation === "stageItemBatch" ||
    request.operation === "stageRouteBatch" ||
    request.operation === "stageProjectionBatch" ||
    request.operation === "stageArtifactBatch"
  ) {
    return {
      batchIndex: request.batchIndex,
      code: "CONTENT_RELEASE_CONFLICT",
      kind: "conflict",
      operation: request.operation,
      releaseId: request.releaseId,
    };
  }
  if (
    request.operation === "stageRelease" ||
    request.operation === "stageRecovery" ||
    request.operation === "verify" ||
    request.operation === "activate" ||
    request.operation === "activateRecovery"
  ) {
    return {
      code: "CONTENT_RELEASE_CONFLICT",
      kind: "conflict",
      operation: request.operation,
      releaseId: request.release.manifest.releaseId,
    };
  }
  if (
    request.operation === "status" ||
    request.operation === "cleanup" ||
    request.operation === "accept" ||
    request.operation === "abort"
  ) {
    return {
      code: "CONTENT_RELEASE_CONFLICT",
      kind: "conflict",
      operation: request.operation,
      releaseId: request.releaseId,
    };
  }
  if (
    request.operation === "rollbackPage" ||
    request.operation === "routePage"
  ) {
    return {
      code: "CONTENT_RELEASE_CONFLICT",
      kind: "conflict",
      operation: request.operation,
      releaseId: request.rollbackOf,
    };
  }
  return null;
}

/** Converts one decoded domain failure into the exact shared wire vocabulary. */
export const requestFailure = Effect.fn("contentRelease.requestFailure")(
  function* (
    request: PublicationRequest,
    error: ReleaseError,
    activeReleaseId: null | ReleaseId
  ) {
    if (error.code === "CONTENT_RELEASE_CONFLICT") {
      const failure = conflictFailure(request);
      return (
        failure ??
        (yield* Effect.die(
          new PublicationFailureDefect({
            code: error.code,
            operation: request.operation,
          })
        ))
      );
    }
    if (error.code === "CONTENT_RELEASE_STALE_BASE") {
      if (
        request.operation !== "stageRelease" &&
        request.operation !== "activate"
      ) {
        return yield* Effect.die(
          new PublicationFailureDefect({
            code: error.code,
            operation: request.operation,
          })
        );
      }
      return {
        activeReleaseId,
        code: error.code,
        expectedBaseReleaseId: request.release.manifest.baseReleaseId,
        kind: "stale-base",
        operation: request.operation,
        releaseId: request.release.manifest.releaseId,
      } satisfies PublicationFailure;
    }
    if (
      error.code === "CONTENT_RELEASE_INVALID_REQUEST" ||
      error.code === "CONTENT_RELEASE_UNAUTHORIZED"
    ) {
      return yield* Effect.die(
        new PublicationFailureDefect({
          code: error.code,
          operation: request.operation,
        })
      );
    }
    if (request.operation === "current") {
      return {
        code: error.code,
        kind: "rejected",
        operation: request.operation,
        releaseId: null,
      } satisfies PublicationFailure;
    }
    return {
      code: error.code,
      kind: "rejected",
      operation: request.operation,
      releaseId: requestReleaseId(request),
    } satisfies PublicationFailure;
  }
);

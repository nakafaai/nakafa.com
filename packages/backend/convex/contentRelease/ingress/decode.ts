import {
  MAX_ARTIFACT_BATCH_BYTES,
  MAX_ITEM_BATCH_BYTES,
  MAX_PROJECTION_BATCH_BYTES,
  MAX_PUBLICATION_REQUEST_BYTES,
  MAX_ROUTE_BATCH_BYTES,
  MAX_SNAPSHOT_BATCH_BYTES,
} from "@nakafa/aksara-contracts/transport/limits";
import {
  decodePublicationRequest,
  type PublicationRequest,
} from "@nakafa/aksara-contracts/transport/request";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

type PublicationOperation = PublicationRequest["operation"];

const REQUEST_LIMITS: Readonly<Record<PublicationOperation, number>> = {
  accept: MAX_PUBLICATION_REQUEST_BYTES,
  abort: MAX_PUBLICATION_REQUEST_BYTES,
  activate: MAX_PUBLICATION_REQUEST_BYTES,
  activateRecovery: MAX_PUBLICATION_REQUEST_BYTES,
  cleanup: MAX_PUBLICATION_REQUEST_BYTES,
  current: MAX_PUBLICATION_REQUEST_BYTES,
  headPage: MAX_PUBLICATION_REQUEST_BYTES,
  recovery: MAX_PUBLICATION_REQUEST_BYTES,
  rollbackPage: MAX_PUBLICATION_REQUEST_BYTES,
  routePage: MAX_PUBLICATION_REQUEST_BYTES,
  stageArtifactBatch: MAX_ARTIFACT_BATCH_BYTES,
  stageItemBatch: MAX_ITEM_BATCH_BYTES,
  stageProjectionBatch: MAX_PROJECTION_BATCH_BYTES,
  stageRecovery: MAX_PUBLICATION_REQUEST_BYTES,
  stageRelease: MAX_PUBLICATION_REQUEST_BYTES,
  stageRouteBatch: MAX_ROUTE_BATCH_BYTES,
  stageSnapshot: MAX_PUBLICATION_REQUEST_BYTES,
  stageSnapshotBatch: MAX_SNAPSHOT_BATCH_BYTES,
  status: MAX_PUBLICATION_REQUEST_BYTES,
  verify: MAX_PUBLICATION_REQUEST_BYTES,
};

/** Creates a sanitized request rejection without retaining source bytes. */
function decodeError(
  code: "CONTENT_RELEASE_INVALID_REQUEST" | "CONTENT_RELEASE_SIZE"
) {
  return new ReleaseError({
    code,
    message: "Content publication request violates its wire contract.",
  });
}

/** Returns the shared complete-body ceiling for one decoded operation. */
export function publicationRequestLimit(operation: PublicationOperation) {
  return REQUEST_LIMITS[operation];
}

/** Enforces an operation-specific complete JSON request ceiling. */
export function validateRequestBytes(
  request: PublicationRequest,
  byteLength: number
) {
  return byteLength <= publicationRequestLimit(request.operation)
    ? Effect.void
    : Effect.fail(decodeError("CONTENT_RELEASE_SIZE"));
}

/** Strictly parses and decodes one exact UTF-8 publication request body. */
export const decodePublicationBody = Effect.fn(
  "contentRelease.decodePublicationBody"
)(function* (source: string, byteLength: number) {
  const actualBytes = new TextEncoder().encode(source).byteLength;
  if (
    actualBytes !== byteLength ||
    actualBytes > MAX_PUBLICATION_REQUEST_BYTES
  ) {
    return yield* decodeError(
      actualBytes > MAX_PUBLICATION_REQUEST_BYTES
        ? "CONTENT_RELEASE_SIZE"
        : "CONTENT_RELEASE_INVALID_REQUEST"
    );
  }
  const unknownBody = yield* Effect.try({
    catch: () => decodeError("CONTENT_RELEASE_INVALID_REQUEST"),
    try: (): unknown => JSON.parse(source),
  });
  const request = yield* decodePublicationRequest(unknownBody).pipe(
    Effect.mapError(() => decodeError("CONTENT_RELEASE_INVALID_REQUEST"))
  );
  yield* validateRequestBytes(request, byteLength);
  return request;
});

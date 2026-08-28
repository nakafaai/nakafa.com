import {
  ContentProjectionSchema,
  canonicalizeContentProjection,
} from "@nakafa/aksara-contracts/projection/spec";
import type { ContentProjection as TransitionProjection } from "@nakafa/aksara-transition/projection/spec";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { Effect, Schema } from "effect";

/** Converts one authenticated stored projection into the current public wire. */
export const encodePublicProjection = Effect.fn(
  "contentRelease.encodePublicProjection"
)(function* (projection: TransitionProjection) {
  const candidate = normalizeStoredProjection(projection);
  const current = yield* Schema.decodeUnknownEffect(ContentProjectionSchema)(
    candidate,
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message:
            "Authenticated content cannot produce its current public projection.",
        })
    )
  );
  return {
    projection: current,
    projectionJson: canonicalizeContentProjection(current),
  };
});

/** Removes the sole retired metadata field before current public decoding. */
function normalizeStoredProjection(projection: TransitionProjection) {
  if (
    (projection.kind !== "article" && projection.kind !== "subject-lesson") ||
    !("date" in projection.metadata)
  ) {
    return projection;
  }
  const { date, ...metadata } = projection.metadata;
  return {
    ...projection,
    metadata: { ...metadata, datePublished: date },
  };
}

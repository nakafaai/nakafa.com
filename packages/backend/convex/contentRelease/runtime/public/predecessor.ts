import {
  canonicalizeContentProjection,
  type RoutedContentProjection,
  RoutedContentProjectionSchema,
} from "@nakafa/aksara-contracts/projection/spec";
import type { PublicContentRuntimeFound } from "@nakafa/aksara-contracts/runtime/spec";
import { encodePredecessorProjection as encodeArticleProjection } from "@repo/backend/convex/contentRelease/article/predecessor";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { encodePredecessorProjection as encodeMaterialProjection } from "@repo/backend/convex/contentRelease/material/predecessor";
import { parseStoredJson } from "@repo/backend/convex/contentRelease/parse";
import { Effect, Schema } from "effect";

/** Derives the exact 0.15.0 projection bytes for one routed projection. */
const encodeProjection = Effect.fn(
  "contentRelease.encodePredecessorRuntimeProjection"
)(function* (projection: RoutedContentProjection) {
  if (projection.kind === "article") {
    return yield* encodeArticleProjection(projection);
  }
  if (projection.kind === "subject-lesson") {
    return yield* encodeMaterialProjection(projection);
  }
  return canonicalizeContentProjection(projection);
});

/** Decodes one derived predecessor projection without widening its family. */
const decodeProjection = Effect.fn(
  "contentRelease.decodePredecessorRuntimeProjection"
)((source: string) =>
  parseStoredJson(source, "Predecessor content projection").pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(RoutedContentProjectionSchema, {
        onExcessProperty: "error",
      })
    ),
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message:
            "Predecessor content projection does not satisfy its exact contract.",
        })
    )
  )
);

/**
 * Builds the authenticated predecessor view for one active current response.
 *
 * The stored projection is decoded and checked against its source hash before
 * this function runs. The active release and manifest remain the target
 * authority. The returned projection hash deliberately identifies the derived
 * 0.15.0 bytes instead of claiming that the stored current hash covers them.
 */
export const makePredecessorRuntime = Effect.fn(
  "contentRelease.makePredecessorRuntime"
)(function* (found: PublicContentRuntimeFound) {
  const projectionJson = yield* encodeProjection(found.projection);
  const projection = yield* decodeProjection(projectionJson);
  const projectionHash = yield* hashText(
    "the predecessor public content projection",
    projectionJson
  );

  return {
    ...found,
    projection,
    projectionHash,
  } satisfies PublicContentRuntimeFound;
});

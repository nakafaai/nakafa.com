import type { MaterialLessonProjection } from "@nakafa/aksara-transition/projection/material";
import {
  canonicalizeMaterialProjection as canonicalizePredecessorMaterialProjection,
  MaterialLessonProjectionSchema as predecessorMaterialProjectionSchema,
} from "@nakafa/aksara-v150/projection/material";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { normalizePublicationDates } from "@repo/contents/_types/publication";
import { Effect, Schema } from "effect";

/** Exact 0.15.0 material projection view derived from shared contract fields. */
export { MaterialLessonProjectionSchema as PredecessorMaterialProjectionSchema } from "@nakafa/aksara-v150/projection/material";

export type MaterialProjectionContract = "predecessor" | "publication";

/**
 * Derives the exact 0.15.0 view required by bounded predecessor queries.
 *
 * The caller authenticates the signed current projection before this adapter
 * runs. The returned JSON is an explicitly derived predecessor view, not the
 * signed projection bytes.
 */
export const encodePredecessorProjection = Effect.fn(
  "contentRelease.encodePredecessorMaterialProjection"
)(function* (projection: MaterialLessonProjection) {
  const dates = normalizePublicationDates(projection.metadata);
  const predecessor = yield* Schema.decodeEffect(
    predecessorMaterialProjectionSchema
  )(
    {
      ...projection,
      metadata: {
        authors: projection.metadata.authors,
        date: dates.datePublished,
        ...(projection.metadata.description === undefined
          ? {}
          : { description: projection.metadata.description }),
        ...(projection.metadata.subject === undefined
          ? {}
          : { subject: projection.metadata.subject }),
        title: projection.metadata.title,
      },
    },
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Material ${projection.contentKey}/${projection.appLocale} cannot produce its predecessor projection view.`,
        })
    )
  );

  return canonicalizePredecessorMaterialProjection(predecessor);
});

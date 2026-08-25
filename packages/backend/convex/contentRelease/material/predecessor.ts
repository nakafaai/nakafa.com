import { DateOnlySchema } from "@nakafa/aksara-contracts/date";
import {
  canonicalizeMaterialProjection,
  type MaterialLessonProjection,
  MaterialLessonProjectionSchema,
  MaterialMetadataSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { normalizePublicationDates } from "@repo/contents/_types/publication";
import { Effect, Schema } from "effect";

const PredecessorMaterialMetadataSchema = MaterialMetadataSchema.mapFields(
  ({
    dateModified: _dateModified,
    datePublished: _datePublished,
    ...fields
  }) => ({ ...fields, date: DateOnlySchema })
);

/** Exact 0.15.0 material projection view derived from shared contract fields. */
export const PredecessorMaterialProjectionSchema =
  MaterialLessonProjectionSchema.mapFields(
    (fields) => ({
      ...fields,
      metadata: PredecessorMaterialMetadataSchema,
    }),
    // The projection checks cover route, locale, graph, and parent identity.
    // Replacing only metadata dates cannot invalidate those checks.
    { unsafePreserveChecks: true }
  );

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
    PredecessorMaterialProjectionSchema
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

  return canonicalizeMaterialProjection(predecessor);
});

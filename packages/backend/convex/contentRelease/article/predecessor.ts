import { DateOnlySchema } from "@nakafa/aksara-contracts/date";
import {
  ArticleMetadataSchema,
  type ArticleProjection,
  ArticleProjectionSchema,
  canonicalizeArticleProjection,
} from "@nakafa/aksara-contracts/projection/article";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { normalizePublicationDates } from "@repo/contents/_types/publication";
import { Effect, Schema } from "effect";

const PredecessorArticleMetadataSchema = ArticleMetadataSchema.mapFields(
  ({
    dateModified: _dateModified,
    datePublished: _datePublished,
    ...fields
  }) => ({ ...fields, date: DateOnlySchema })
);

/** Exact 0.15.0 article projection view derived from shared contract fields. */
export const PredecessorArticleProjectionSchema =
  ArticleProjectionSchema.mapFields(
    (fields) => ({ ...fields, metadata: PredecessorArticleMetadataSchema }),
    // The projection checks cover route, locale, graph, and parent identity.
    // Replacing only metadata dates cannot invalidate those checks.
    { unsafePreserveChecks: true }
  );

/**
 * Derives the exact 0.15.0 view required by the bounded predecessor query.
 *
 * The caller authenticates the signed current projection before this adapter
 * runs. Its source projection hash remains the provenance identifier; the
 * returned JSON is an explicitly derived predecessor view, not signed bytes.
 */
export const encodePredecessorProjection = Effect.fn(
  "contentRelease.encodePredecessorProjection"
)(function* (projection: ArticleProjection) {
  const dates = normalizePublicationDates(projection.metadata);
  const predecessor = yield* Schema.decodeEffect(
    PredecessorArticleProjectionSchema
  )(
    {
      ...projection,
      metadata: {
        authors: projection.metadata.authors,
        date: dates.datePublished,
        ...(projection.metadata.description === undefined
          ? {}
          : { description: projection.metadata.description }),
        title: projection.metadata.title,
      },
    },
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Article ${projection.contentKey}/${projection.appLocale} cannot produce its predecessor projection view.`,
        })
    )
  );

  return canonicalizeArticleProjection(predecessor);
});

import type { ArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import {
  canonicalizeArticleProjection as canonicalizePredecessorArticleProjection,
  ArticleProjectionSchema as predecessorArticleProjectionSchema,
} from "@nakafa/aksara-v150/projection/article";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { normalizePublicationDates } from "@repo/contents/_types/publication";
import { Effect, Schema } from "effect";

/** Exact 0.15.0 article projection view derived from shared contract fields. */
export { ArticleProjectionSchema as PredecessorArticleProjectionSchema } from "@nakafa/aksara-v150/projection/article";

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
    predecessorArticleProjectionSchema
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

  return canonicalizePredecessorArticleProjection(predecessor);
});

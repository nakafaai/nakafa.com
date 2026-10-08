import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  type ArticleProjection,
  ArticleProjectionSchema,
  canonicalizeArticleProjection,
} from "@nakafa/aksara-contracts/projection/article";
import { Effect, Schema } from "effect";
import {
  PublishedProjectionError,
  type PublishedProjectionIdentity,
  PublishedReleaseMismatchError,
} from "@/lib/content/published/errors";

const ArticlePublicationReadSchema = Schema.Struct({
  activeReleaseId: ReleaseIdSchema,
  projection: ArticleProjectionSchema,
});
type ArticlePublicationRead = typeof ArticlePublicationReadSchema.Type;

/** Creates the public failure returned for malformed article projection data. */
export function makeArticleProjectionError(
  identity: PublishedProjectionIdentity
) {
  return new PublishedProjectionError(identity);
}

/** Parses one canonical article projection encoded by the backend. */
export const decodeArticleJson = Effect.fn("NakafaArticle.decodeJson")(
  function* (source: string, identity: PublishedProjectionIdentity) {
    return yield* Schema.decodeEffect(
      Schema.fromJsonString(ArticleProjectionSchema)
    )(source, {
      onExcessProperty: "error",
    }).pipe(Effect.mapError(() => makeArticleProjectionError(identity)));
  }
);

/** Checks whether two article projections share one stable content identity. */
export function isArticleCounterpart(
  current: ArticleProjection,
  candidate: ArticleProjection
) {
  return current.contentKey === candidate.contentKey;
}

/** Proves two concurrent article reads selected one identical publication. */
export const verifyArticlePublication = Effect.fn(
  "NakafaArticle.verifyPublication"
)(function* (catalog: ArticlePublicationRead, runtime: ArticlePublicationRead) {
  const identity = {
    appLocale: catalog.projection.appLocale,
    publicPath: catalog.projection.publicPath,
  };
  if (runtime.activeReleaseId !== catalog.activeReleaseId) {
    return yield* new PublishedReleaseMismatchError({
      actualReleaseId: runtime.activeReleaseId,
      expectedReleaseId: catalog.activeReleaseId,
    });
  }
  if (
    canonicalizeArticleProjection(runtime.projection) !==
    canonicalizeArticleProjection(catalog.projection)
  ) {
    return yield* makeArticleProjectionError(identity);
  }
});

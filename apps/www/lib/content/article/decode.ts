import {
  type ArticleProjection,
  ArticleProjectionSchema,
  canonicalizeArticleProjection,
} from "@nakafa/aksara-contracts/projection/article";
import { Effect, Schema } from "effect";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import {
  PublishedProjectionError,
  type PublishedProjectionIdentity,
  PublishedReleaseMismatchError,
} from "@/lib/content/published/errors";

interface ArticlePublicationRead {
  readonly activeReleaseId: ActiveContentReleaseId;
  readonly projection: ArticleProjection;
}

/** Creates the public failure returned for malformed article projection data. */
export function makeArticleProjectionError(
  identity: PublishedProjectionIdentity
) {
  return new PublishedProjectionError(identity);
}

/** Parses one canonical article projection encoded by the backend. */
export const decodeArticleJson = Effect.fn("NakafaArticle.decodeJson")(
  function* (source: string, identity: PublishedProjectionIdentity) {
    const input = yield* Effect.try({
      catch: () => makeArticleProjectionError(identity),
      try: (): unknown => JSON.parse(source),
    });
    return yield* Schema.decodeUnknownEffect(ArticleProjectionSchema)(input, {
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

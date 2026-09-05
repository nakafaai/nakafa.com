import { ArticleCategorySchema } from "@nakafa/aksara-contracts/projection/article";
import { ArticleSource } from "@repo/backend/content/article/source";
import { resolvePublicProjection } from "@repo/backend/content/publication/projection";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { Effect, Option, Schema } from "effect";

type ArticleRow = PublicationRow<"articleCatalog">;
type CategoryRow = PublicationRow<"articleCategories">;
/** Authenticates catalog metadata against an already resolved public projection. */
export const verifyArticleProjection = Effect.fn(
  "contentRelease.verifyArticleProjection"
)(function* (
  row: ArticleRow,
  resolved: Effect.Success<ReturnType<typeof resolvePublicProjection>>
) {
  if (
    resolved?.projection.kind !== "article" ||
    resolved.projectionHash !== row.projectionHash ||
    resolved.publicPath !== row.publicPath ||
    resolved.releaseId !== row.releaseId ||
    resolved.rendererDomain !== row.rendererDomain ||
    resolved.sequence !== row.sequence
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active article ${row.contentKey}/${row.appLocale} is stale.`
    );
  }
  const { projection } = resolved;
  if (
    projection.graph.assetId !== row.assetId ||
    projection.category !== row.category ||
    projection.categoryTitle !== row.categoryTitle ||
    projection.metadata.dateModified !== row.dateModified ||
    projection.metadata.datePublished !== row.datePublished
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active article ${row.contentKey}/${row.appLocale} changed catalog metadata.`
    );
  }
  return {
    projection,
    resolved: {
      appLocale: resolved.appLocale,
      artifactLocale: resolved.artifactLocale,
      contentKey: resolved.contentKey,
      family: projection.kind,
      projectionHash: resolved.projectionHash,
      projectionJson: resolved.projectionJson,
      publicPath: resolved.publicPath,
      releaseId: resolved.releaseId,
      rendererDomain: resolved.rendererDomain,
      sequence: resolved.sequence,
      sourcePath: resolved.sourcePath,
    },
  };
});

/** Authenticates one article row against its effective immutable projection. */
export const verifyArticle = Effect.fn("contentRelease.verifyArticle")(
  function* (row: ArticleRow, activeSequence: number) {
    const resolved = yield* resolvePublicProjection(
      row.contentKey,
      row.appLocale,
      activeSequence
    );
    return yield* verifyArticleProjection(row, resolved);
  }
);
/** Authenticates one category representative in a complete article model. */
export const verifyCategory = Effect.fn("contentRelease.verifyArticleCategory")(
  function* (category: CategoryRow, activeSequence: number) {
    const source = yield* ArticleSource;
    const article = yield* source
      .article(category.slot, category.contentKey, category.appLocale)
      .pipe(Effect.map(Option.getOrNull));
    if (!article) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Article category ${category.appLocale}/${category.category} lost its representative.`
      );
    }
    const verified = yield* verifyArticle(article, activeSequence);
    if (
      verified.projection.category !== category.category ||
      verified.projection.categoryTitle !== category.title ||
      (category.route !== undefined &&
        verified.projection.categoryRouteSlug !== category.route) ||
      verified.resolved.projectionHash !== category.projectionHash ||
      verified.resolved.releaseId !== category.releaseId ||
      verified.resolved.rendererDomain !== category.rendererDomain ||
      verified.resolved.sequence !== category.sequence
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Article category ${category.appLocale}/${category.category} is stale.`
      );
    }
    return {
      category: category.category,
      rendererDomain: category.rendererDomain,
      route: verified.projection.categoryRouteSlug,
      title: category.title,
    };
  }
);
/** Validates one requested category through the public source contract. */
export const decodeCategory = Effect.fn("contentRelease.decodeArticleCategory")(
  function* (source: string) {
    return yield* Schema.decodeEffect(ArticleCategorySchema)(source).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_LIMIT",
            message: "The article category must be a lowercase kebab segment.",
          })
      )
    );
  }
);

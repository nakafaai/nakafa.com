import { ArticleCategorySchema } from "@nakafa/aksara-contracts/projection/article";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { readArticleDates } from "@repo/backend/convex/contentRelease/article/dates";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import { normalizePublicationDates } from "@repo/contents/_types/publication";
import { Effect, Schema } from "effect";

type ArticleRow = Doc<"articleCatalog">;
type CategoryRow = Doc<"articleCategories">;
/** Authenticates one active article row against its immutable projection. */
export const verifyArticle = Effect.fn("contentRelease.verifyArticle")(
  function* (ctx: QueryCtx, row: ArticleRow, activeSequence: number) {
    const resolved = yield* resolvePublicProjection(
      ctx,
      row.contentKey,
      row.appLocale,
      activeSequence
    );
    if (
      resolved?.family !== "article" ||
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
    const projection = yield* decodeProjectionJson(resolved.projectionJson);
    if (projection.kind !== "article") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Active article ${row.contentKey}/${row.appLocale} has a non-article projection.`
      );
    }
    const projectionDates = normalizePublicationDates(projection.metadata);
    const rowDates = yield* readArticleDates(row);
    if (
      projection.graph.assetId !== row.assetId ||
      projection.category !== row.category ||
      projection.categoryTitle !== row.categoryTitle ||
      projectionDates.dateModified !== rowDates.dateModified ||
      projectionDates.datePublished !== rowDates.datePublished
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
  }
);
/** Authenticates one category representative in a complete article model. */
export const verifyCategory = Effect.fn("contentRelease.verifyArticleCategory")(
  function* (ctx: QueryCtx, category: CategoryRow, activeSequence: number) {
    const article = yield* Effect.promise(() =>
      ctx.db
        .query("articleCatalog")
        .withIndex("by_contentKey_and_appLocale", (index) =>
          index
            .eq("contentKey", category.contentKey)
            .eq("appLocale", category.appLocale)
        )
        .unique()
    );
    if (!article) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Article category ${category.appLocale}/${category.category} lost its representative.`
      );
    }
    const verified = yield* verifyArticle(ctx, article, activeSequence);
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

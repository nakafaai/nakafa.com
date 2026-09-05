import { loadArticleOwner } from "@repo/backend/content/article/owner";
import { ArticleSource } from "@repo/backend/content/article/source";
import { verifyArticleProjection } from "@repo/backend/content/article/verify";
import { resolveActiveRoute } from "@repo/backend/content/publication/route";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect, Option } from "effect";

/** Resolves one active article route and its authenticated catalog row. */
export const resolveArticleRoute = Effect.fn(
  "contentRelease.resolveArticleRoute"
)(function* (
  appLocale: PublicationRow<"articleCatalog">["appLocale"],
  publicPath: string
) {
  const [owner, route] = yield* Effect.all([
    loadArticleOwner(appLocale),
    resolveActiveRoute("article", appLocale, publicPath),
  ]);
  if (
    !(
      owner.managed &&
      owner.active &&
      owner.slot &&
      route.managed &&
      route.active
    )
  ) {
    return {
      active: route.active,
      article: null,
      managed: false,
    };
  }
  if (!route.projection) {
    return {
      active: route.active,
      article: null,
      managed: true,
    };
  }
  const source = yield* ArticleSource;
  const row = yield* source
    .article(owner.slot, route.projection.contentKey, appLocale)
    .pipe(Effect.map(Option.getOrNull));
  if (!row) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active article ${route.projection.contentKey}/${appLocale} lost its catalog row.`
    );
  }
  const verified = yield* verifyArticleProjection(row, route.projection);
  return {
    active: route.active,
    article: { ...verified, row },
    managed: true,
  };
});

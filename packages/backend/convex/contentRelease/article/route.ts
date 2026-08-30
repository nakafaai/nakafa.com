import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadArticleOwner } from "@repo/backend/convex/contentRelease/article/owner";
import { verifyArticle } from "@repo/backend/convex/contentRelease/article/verify";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { resolveActiveRoute } from "@repo/backend/convex/contentRelease/scope/route";
import { Effect } from "effect";

/** Resolves one active article route and its authenticated catalog row. */
export const resolveArticleRoute = Effect.fn(
  "contentRelease.resolveArticleRoute"
)(function* (
  ctx: QueryCtx,
  appLocale: Doc<"articleCatalog">["appLocale"],
  publicPath: string
) {
  const [owner, route] = yield* Effect.all([
    loadArticleOwner(ctx, appLocale),
    resolveActiveRoute(ctx, "article", appLocale, publicPath),
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
  if (
    owner.active.releaseId !== route.active.releaseId ||
    owner.active.sequence !== route.active.sequence
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article route ${appLocale}/${publicPath} disagrees with its active owner.`
    );
  }
  if (!route.projection) {
    return {
      active: route.active,
      article: null,
      managed: true,
    };
  }
  const row = yield* Effect.promise(() =>
    ctx.db
      .query("articleCatalog")
      .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
        index
          .eq("slot", owner.slot)
          .eq("contentKey", route.projection.contentKey)
          .eq("appLocale", appLocale)
      )
      .unique()
  );
  if (!row) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active article ${route.projection.contentKey}/${appLocale} lost its catalog row.`
    );
  }
  const verified = yield* verifyArticle(ctx, row, route.active.sequence);
  if (
    verified.resolved.projectionHash !== route.projection.projectionHash ||
    verified.resolved.projectionJson !== route.projection.projectionJson ||
    verified.resolved.rendererDomain !== route.projection.rendererDomain ||
    verified.resolved.sourcePath !== route.projection.sourcePath
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active article ${route.projection.contentKey}/${appLocale} disagrees with its published route.`
    );
  }
  return {
    active: route.active,
    article: { ...verified, row },
    managed: true,
  };
});

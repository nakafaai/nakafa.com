import type { ActiveAppLocaleList } from "@nakafa/aksara-contracts/locale";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { resolveArticleRoute } from "@repo/backend/convex/contentRelease/article/route";
import { verifyArticle } from "@repo/backend/convex/contentRelease/article/verify";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { requireExpectedActiveRelease } from "@repo/backend/convex/contentRelease/runtime/pin";
import { Effect } from "effect";

/** Reads every locale-specific counterpart for one stable article identity. */
const readAlternates = Effect.fn("contentRelease.readArticleAlternates")(
  function* (
    ctx: QueryCtx,
    row: Doc<"articleCatalog">,
    activeAppLocales: ActiveAppLocaleList,
    activeSequence: number
  ) {
    return yield* Effect.forEach(activeAppLocales, (appLocale) =>
      Effect.gen(function* () {
        const alternate = yield* Effect.promise(() =>
          ctx.db
            .query("articleCatalog")
            .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
              index
                .eq("slot", row.slot)
                .eq("contentKey", row.contentKey)
                .eq("appLocale", appLocale)
            )
            .unique()
        );
        if (!alternate) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            `Article ${row.contentKey} lost locale ${appLocale}.`
          );
        }
        return yield* verifyArticle(ctx, alternate, activeSequence);
      })
    );
  }
);

/** Resolves one article projection and every active localized counterpart. */
export const readArticleModel = Effect.fn("contentRelease.readArticleModel")(
  function* (
    ctx: QueryCtx,
    appLocale: Doc<"articleCatalog">["appLocale"],
    publicPath: string,
    expectedActiveReleaseId?: string | null
  ) {
    const route = yield* resolveArticleRoute(ctx, appLocale, publicPath);
    yield* requireExpectedActiveRelease(
      route.active,
      expectedActiveReleaseId,
      "Article route"
    );
    if (!(route.managed && route.active)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Signed article ownership is unavailable for ${appLocale}.`
      );
    }
    const activeAppLocales = Array.from(
      route.active.signed.manifest.activeAppLocales
    );
    if (!route.article) {
      return {
        activeAppLocales,
        activeReleaseId: route.active.releaseId,
        alternateJson: [],
        projectionJson: null,
      };
    }
    const alternates = yield* readAlternates(
      ctx,
      route.article.row,
      route.active.signed.manifest.activeAppLocales,
      route.active.sequence
    );
    return {
      activeAppLocales,
      activeReleaseId: route.active.releaseId,
      alternateJson: alternates.map(({ resolved }) => resolved.projectionJson),
      projectionJson: route.article.resolved.projectionJson,
    };
  }
);

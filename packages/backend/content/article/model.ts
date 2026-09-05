import type { ActiveAppLocaleList } from "@nakafa/aksara-contracts/locale";
import { resolveArticleRoute } from "@repo/backend/content/article/route";
import { ArticleSource } from "@repo/backend/content/article/source";
import { verifyArticle } from "@repo/backend/content/article/verify";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { requireExpectedActiveRelease } from "@repo/backend/convex/contentRelease/runtime/pin";
import { Effect, Option } from "effect";

/** Reads every locale-specific counterpart for one stable article identity. */
const readAlternates = Effect.fn("contentRelease.readArticleAlternates")(
  function* (
    row: PublicationRow<"articleCatalog">,
    activeAppLocales: ActiveAppLocaleList,
    activeSequence: number
  ) {
    return yield* Effect.forEach(activeAppLocales, (appLocale) =>
      Effect.gen(function* () {
        const source = yield* ArticleSource;
        const alternate = yield* source
          .article(row.slot, row.contentKey, appLocale)
          .pipe(Effect.map(Option.getOrNull));
        if (!alternate) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            `Article ${row.contentKey} lost locale ${appLocale}.`
          );
        }
        return yield* verifyArticle(alternate, activeSequence);
      })
    );
  }
);

/** Resolves one article projection and every active localized counterpart. */
export const readArticleModel = Effect.fn("contentRelease.readArticleModel")(
  function* (
    appLocale: PublicationRow<"articleCatalog">["appLocale"],
    publicPath: string,
    expectedActiveReleaseId?: string | null
  ) {
    const route = yield* resolveArticleRoute(appLocale, publicPath);
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

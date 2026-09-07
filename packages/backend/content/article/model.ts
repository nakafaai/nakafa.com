import type { ActiveAppLocaleList } from "@nakafa/aksara-contracts/locale";
import { resolveArticleRoute } from "@repo/backend/content/article/route";
import { ArticleSource } from "@repo/backend/content/article/source";
import { verifyArticle } from "@repo/backend/content/article/verify";
import { encodePublicDelivery } from "@repo/backend/content/publication/exchange";
import { readSelectedPublicRuntime } from "@repo/backend/content/publication/public";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { requireExpectedActiveRelease } from "@repo/backend/convex/contentRelease/runtime/pin";
import { Effect, Option } from "effect";

/** Reads every locale-specific counterpart for one stable article identity. */
const readAlternates = Effect.fn("contentRelease.readArticleAlternates")(
  function* (
    requested: NonNullable<
      Effect.Success<ReturnType<typeof resolveArticleRoute>>["article"]
    >,
    activeAppLocales: ActiveAppLocaleList,
    activeSequence: number
  ) {
    const { row } = requested;
    return yield* Effect.forEach(activeAppLocales, (appLocale) =>
      Effect.gen(function* () {
        if (appLocale === row.appLocale) {
          return requested;
        }
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
const assembleArticleModel = Effect.fn("contentRelease.assembleArticleModel")(
  function* (
    appLocale: PublicationRow<"articleCatalog">["appLocale"],
    route: Effect.Success<ReturnType<typeof resolveArticleRoute>>,
    expectedActiveReleaseId?: string | null
  ) {
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
      route.article,
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

/** Resolves one article projection and every active localized counterpart. */
export const readArticleModel = Effect.fn("contentRelease.readArticleModel")(
  function* (
    appLocale: PublicationRow<"articleCatalog">["appLocale"],
    publicPath: string,
    expectedActiveReleaseId?: string | null
  ) {
    const route = yield* resolveArticleRoute(appLocale, publicPath);
    return yield* assembleArticleModel(
      appLocale,
      route,
      expectedActiveReleaseId
    );
  }
);

/** Reads the article shell and signed body in one Convex snapshot. */
export const readArticleDelivery = Effect.fn(
  "contentRelease.readArticleDelivery"
)(function* (
  appLocale: PublicationRow<"articleCatalog">["appLocale"],
  publicPath: string
) {
  const route = yield* resolveArticleRoute(appLocale, publicPath);
  const model = yield* assembleArticleModel(appLocale, route);
  const runtime = yield* readSelectedPublicRuntime(route);
  const runtimeJson = yield* encodePublicDelivery(runtime, model);
  return { model, runtimeJson };
});

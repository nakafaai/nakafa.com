import "server-only";

import {
  ActiveAppLocaleListSchema,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import type { ArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import { readArticleModel } from "@repo/backend/content/article/model";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import {
  decodeArticleJson,
  isArticleCounterpart,
  makeArticleProjectionError,
} from "@/lib/content/article/decode";
import { applyPublishedCatalogCache } from "@/lib/content/cache";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import {
  type ContentReleasePin,
  decodeContentReleasePin,
} from "@/lib/content/published/release";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

/** Complete active article route or a signed missing-route tombstone. */
export type PublishedArticleRoute =
  | {
      readonly activeReleaseId: ActiveContentReleaseId;
      readonly alternates: readonly [];
      readonly projection: null;
    }
  | {
      readonly activeReleaseId: ActiveContentReleaseId;
      readonly alternates: readonly ArticleProjection[];
      readonly projection: ArticleProjection;
    };

/** Reads and validates one complete signed article route model. */
export const readPublishedArticleRoute = Effect.fn(
  "NakafaArticle.readPublishedRoute"
)(function* (
  locale: Locale,
  publicPath: string,
  expectedActiveReleaseId?: ContentReleasePin
) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* readRuntimeQuery(
    api.contentRelease.article.route,
    {
      ...(expectedActiveReleaseId === undefined
        ? {}
        : { expectedActiveReleaseId }),
      appLocale,
      publicPath,
    },
    (queryArgs) =>
      readArticleModel(
        queryArgs.appLocale,
        queryArgs.publicPath,
        queryArgs.expectedActiveReleaseId
      )
  );
  const [activeAppLocales, activeReleaseId] = yield* Effect.all([
    Schema.decodeUnknownEffect(ActiveAppLocaleListSchema)(
      result.activeAppLocales
    ).pipe(
      Effect.mapError(() =>
        makeArticleProjectionError({ appLocale, publicPath })
      )
    ),
    decodeContentReleasePin(result.activeReleaseId, expectedActiveReleaseId, {
      appLocale,
      publicPath,
    }),
  ]);
  if (activeReleaseId === null) {
    return yield* makeArticleProjectionError({ appLocale, publicPath });
  }
  if (result.projectionJson === null) {
    return {
      activeReleaseId,
      alternates: [],
      projection: null,
    } satisfies PublishedArticleRoute;
  }
  const projection = yield* decodeArticleJson(result.projectionJson, {
    appLocale,
    publicPath,
  });
  const alternates = yield* Effect.forEach(result.alternateJson, (source) =>
    decodeArticleJson(source, { appLocale, publicPath })
  );
  const alternateLocales = new Set(
    alternates.map((alternate) => alternate.appLocale)
  );
  const completeLocaleSet =
    alternateLocales.size === activeAppLocales.length &&
    activeAppLocales.every((alternateLocale) =>
      alternateLocales.has(alternateLocale)
    );
  if (
    projection.appLocale !== appLocale ||
    projection.publicPath !== publicPath ||
    alternates.some(
      (alternate) => !isArticleCounterpart(projection, alternate)
    ) ||
    alternateLocales.size !== alternates.length ||
    !alternates.some(
      (alternate) =>
        alternate.appLocale === projection.appLocale &&
        alternate.publicPath === projection.publicPath
    ) ||
    !completeLocaleSet
  ) {
    return yield* makeArticleProjectionError({ appLocale, publicPath });
  }
  return {
    activeReleaseId,
    alternates,
    projection,
  } satisfies PublishedArticleRoute;
});

/** Caches one exact signed article model under release invalidation. */
export async function getPublishedArticleRoute(
  locale: Locale,
  publicPath: string,
  expectedActiveReleaseId?: ContentReleasePin
) {
  "use cache";

  const result = await Effect.runPromise(
    readPublishedArticleRoute(locale, publicPath, expectedActiveReleaseId)
  );
  applyPublishedCatalogCache("article");
  return result;
}

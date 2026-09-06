import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { env } from "@/env";
import "server-only";

import {
  ActiveAppLocaleListSchema,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import type { ArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import {
  decodeArticleJson,
  isArticleCounterpart,
  makeArticleProjectionError,
} from "@/lib/content/article/decode";
import { applyContentCache } from "@/lib/content/cache";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import {
  type ContentReleasePin,
  decodeContentReleasePin,
} from "@/lib/content/published/release";

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
  const result = yield* readNakafaRuntimeQuery(
    env.NEXT_PUBLIC_CONVEX_URL,
    api.contentRelease.article.route,
    {
      ...(expectedActiveReleaseId === undefined
        ? {}
        : { expectedActiveReleaseId }),
      appLocale,
      publicPath,
    }
  );
  return yield* decodePublishedArticleRoute(
    result,
    locale,
    publicPath,
    expectedActiveReleaseId
  );
});

/** Validates the route model delivered alone or with its signed public body. */
export const decodePublishedArticleRoute = Effect.fn(
  "NakafaArticle.decodePublishedRoute"
)(function* (
  result: FunctionReturnType<typeof api.contentRelease.article.route>,
  locale: Locale,
  publicPath: string,
  expectedActiveReleaseId?: ContentReleasePin
) {
  const appLocale = AppLocaleSchema.make(locale);
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
  applyContentCache("article");
  return result;
}

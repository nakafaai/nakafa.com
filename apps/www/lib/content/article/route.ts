import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import "server-only";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  ActiveAppLocaleListSchema,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { ArticleProjectionSchema } from "@nakafa/aksara-contracts/projection/article";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Array as Arr, Effect, HashSet, Schema } from "effect";
import type { Locale } from "next-intl";
import {
  decodeArticleJson,
  isArticleCounterpart,
  makeArticleProjectionError,
} from "@/lib/content/article/decode";
import {
  type ContentReleasePin,
  decodeContentReleasePin,
} from "@/lib/content/published/release";
import { httpLayer } from "@/lib/convex/http";

const PublishedArticleRouteSchema = Schema.Union([
  Schema.Struct({
    activeReleaseId: ReleaseIdSchema,
    alternates: Schema.Tuple([]),
    projection: Schema.Null,
  }),
  Schema.Struct({
    activeReleaseId: ReleaseIdSchema,
    alternates: Schema.Array(ArticleProjectionSchema),
    projection: ArticleProjectionSchema,
  }),
]);

/** Complete active article route or a signed missing-route tombstone. */
export type PublishedArticleRoute = typeof PublishedArticleRouteSchema.Type;

/** Reads and validates one complete signed article route model. */
export const readPublishedArticleRoute = Effect.fn(
  "NakafaArticle.readPublishedRoute"
)(function* (
  locale: Locale,
  publicPath: string,
  expectedActiveReleaseId?: ContentReleasePin
) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(contentRelease.article.route, {
      ...(expectedActiveReleaseId === undefined
        ? {}
        : {
            expectedActiveReleaseId,
          }),
      appLocale,
      publicPath,
    })
  ).pipe(Effect.provide(httpLayer()));
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
  result: Ref.Returns<typeof contentRelease.article.route>,
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
        makeArticleProjectionError({
          appLocale,
          publicPath,
        })
      )
    ),
    decodeContentReleasePin(result.activeReleaseId, expectedActiveReleaseId, {
      appLocale,
      publicPath,
    }),
  ]);
  if (activeReleaseId === null) {
    return yield* makeArticleProjectionError({
      appLocale,
      publicPath,
    });
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
    decodeArticleJson(source, {
      appLocale,
      publicPath,
    })
  );
  const alternateLocales = HashSet.fromIterable(
    Arr.map(alternates, (alternate) => alternate.appLocale)
  );
  const completeLocaleSet =
    HashSet.size(alternateLocales) === activeAppLocales.length &&
    Arr.every(activeAppLocales, (alternateLocale) =>
      HashSet.has(alternateLocales, alternateLocale)
    );
  if (
    projection.appLocale !== appLocale ||
    projection.publicPath !== publicPath ||
    Arr.some(
      alternates,
      (alternate) => !isArticleCounterpart(projection, alternate)
    ) ||
    HashSet.size(alternateLocales) !== alternates.length ||
    !Arr.some(
      alternates,
      (alternate) =>
        alternate.appLocale === projection.appLocale &&
        alternate.publicPath === projection.publicPath
    ) ||
    !completeLocaleSet
  ) {
    return yield* makeArticleProjectionError({
      appLocale,
      publicPath,
    });
  }
  return {
    activeReleaseId,
    alternates,
    projection,
  } satisfies PublishedArticleRoute;
});

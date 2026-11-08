import type { Ref } from "@confect/core";
import "@tanstack/react-start/server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect, Option } from "effect";
import type { Locale } from "use-intl";
import {
  makeArticleProjectionError,
  verifyArticlePublication,
} from "@/lib/content/article/decode";
import { decodePublishedArticleRoute } from "@/lib/content/article/route";
import {
  decodeArticleData,
  renderArticleArtifact,
} from "@/lib/content/published/article";
import { decodePublishedDelivery } from "@/lib/content/published/exchange";
import { queryContentStore } from "@/lib/content/store/query";

/** Verifies the signed query result without evaluating its immutable body.
 *
 * Static consumers such as social images resolve metadata through this seam
 * so their module graph never renders interactive renderers. */
const decodeArticleModel = Effect.fn("NakafaArticle.decodeModel")(function* (
  source: Ref.Returns<typeof contentRelease.article.delivery>,
  locale: Locale,
  publicPath: string
) {
  const input = {
    appLocale: AppLocaleSchema.make(locale),
    publicPath,
  };
  const model = yield* decodePublishedArticleRoute(
    source.model,
    locale,
    publicPath
  );
  if (!model.projection) {
    if (source.runtimeJson !== null) {
      return yield* makeArticleProjectionError(input);
    }
    return Option.none();
  }
  if (source.runtimeJson === null) {
    return yield* makeArticleProjectionError(input);
  }
  const data = yield* decodePublishedDelivery(input, source.runtimeJson);
  const narrowed = yield* decodeArticleData(data, input);
  yield* verifyArticlePublication(
    {
      activeReleaseId: model.activeReleaseId,
      projection: model.projection,
    },
    narrowed
  );
  return Option.some({
    model,
    narrowed,
  });
});

/** Verifies the complete query result before evaluating its immutable body. */
const decodeArticleDelivery = Effect.fn("NakafaArticle.decodeDelivery")(
  function* (
    source: Ref.Returns<typeof contentRelease.article.delivery>,
    locale: Locale,
    publicPath: string
  ) {
    const decoded = yield* decodeArticleModel(source, locale, publicPath);
    if (Option.isNone(decoded)) {
      return Option.none();
    }
    const published = yield* renderArticleArtifact(decoded.value.narrowed);
    return Option.some({
      model: decoded.value.model,
      published,
    });
  }
);

/**
 * Reads one signed delivery row, which the page and its social image share.
 * The content store keeps it for the release, so a build reads each article
 * from Convex once, and a deploy of the same release reads it from the deploy's
 * read store instead.
 */
const fetchArticleSource = Effect.fn("NakafaArticle.fetchSource")(function* (
  locale: Locale,
  publicPath: string
) {
  return yield* queryContentStore(contentRelease.article.delivery, {
    appLocale: AppLocaleSchema.make(locale),
    publicPath,
  });
});

/** Reads and verifies one signed article delivery for the article page. */
export const getArticlePublication = Effect.fn("NakafaArticle.getPublication")(
  function* (locale: Locale, publicPath: string) {
    const source = yield* fetchArticleSource(locale, publicPath);
    return yield* decodeArticleDelivery(source, locale, publicPath);
  }
);

/** Reads and verifies signed release metadata without rendering its body.
 *
 * Social images resolve copy through this seam so a missing release falls
 * back to brand artwork instead of rendering the application shell. */
export const getArticleModel = Effect.fn("NakafaArticle.getModel")(function* (
  locale: Locale,
  publicPath: string
) {
  const source = yield* fetchArticleSource(locale, publicPath);
  return yield* decodeArticleModel(source, locale, publicPath);
});

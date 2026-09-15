import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { cache } from "react";
import { env } from "@/env";
import {
  makeArticleProjectionError,
  verifyArticlePublication,
} from "@/lib/content/article/decode";
import { decodePublishedArticleRoute } from "@/lib/content/article/route";
import { applyContentCache } from "@/lib/content/cache";
import {
  decodeArticleData,
  renderArticleArtifact,
} from "@/lib/content/published/article";
import { decodePublishedDelivery } from "@/lib/content/published/exchange";

/** Verifies the signed query result without evaluating its immutable body.
 *
 * Static consumers such as social images resolve metadata through this seam
 * so their module graph never renders interactive renderers. */
export const decodeArticleModel = Effect.fn("NakafaArticle.decodeModel")(
  function* (
    source: FunctionReturnType<typeof api.contentRelease.article.delivery>,
    locale: Locale,
    publicPath: string
  ) {
    const input = { appLocale: AppLocaleSchema.make(locale), publicPath };
    const model = yield* decodePublishedArticleRoute(
      source.model,
      locale,
      publicPath
    );
    if (!model.projection) {
      if (source.runtimeJson !== null) {
        return yield* makeArticleProjectionError(input);
      }
      return null;
    }
    if (source.runtimeJson === null) {
      return yield* makeArticleProjectionError(input);
    }
    const data = yield* decodePublishedDelivery(input, source.runtimeJson);
    const narrowed = yield* decodeArticleData(data, input);
    yield* verifyArticlePublication(
      { activeReleaseId: model.activeReleaseId, projection: model.projection },
      narrowed
    );
    return { model, narrowed };
  }
);

/** Verifies the complete query result before evaluating its immutable body. */
export const decodeArticleDelivery = Effect.fn("NakafaArticle.decodeDelivery")(
  function* (
    source: FunctionReturnType<typeof api.contentRelease.article.delivery>,
    locale: Locale,
    publicPath: string
  ) {
    const decoded = yield* decodeArticleModel(source, locale, publicPath);
    if (!decoded) {
      return null;
    }
    const published = yield* renderArticleArtifact(decoded.narrowed);
    return { model: decoded.model, published };
  }
);

/** Fetches one signed delivery row shared by body and metadata readers. */
async function fetchArticleSource(locale: Locale, publicPath: string) {
  return await fetchQuery(
    api.contentRelease.article.delivery,
    {
      appLocale: AppLocaleSchema.make(locale),
      publicPath,
    },
    { url: env.NEXT_PUBLIC_CONVEX_URL }
  );
}

/** Reads and verifies one signed article delivery inside the content cache. */
async function readArticleDelivery(locale: Locale, publicPath: string) {
  "use cache";

  applyContentCache("article");
  // Start native IO before Effect during request-less static rendering.
  // https://nextjs.org/docs/messages/next-prerender-current-time
  const source = await fetchArticleSource(locale, publicPath);
  return await Effect.runPromise(
    decodeArticleDelivery(source, locale, publicPath)
  );
}

/**
 * Shares one verified delivery between the article metadata and body in a
 * single render pass. https://react.dev/reference/react/cache
 */
export const getArticlePublication = cache(readArticleDelivery);

/** Reads and verifies signed release metadata without rendering its body.
 *
 * Social images resolve copy through this seam so a missing release falls
 * back to brand artwork instead of rendering the application shell. */
async function readArticleModel(locale: Locale, publicPath: string) {
  "use cache";

  applyContentCache("article");
  const source = await fetchArticleSource(locale, publicPath);
  return await Effect.runPromise(
    decodeArticleModel(source, locale, publicPath)
  );
}

export const getArticleModel = cache(readArticleModel);

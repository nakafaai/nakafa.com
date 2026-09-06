import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import type { Locale } from "next-intl";
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

/** Verifies the complete query result before evaluating its immutable body. */
export const decodeArticleDelivery = Effect.fn("NakafaArticle.decodeDelivery")(
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
    const published = yield* renderArticleArtifact(narrowed);
    return { model, published };
  }
);

/** Caches a coherent shell selection separately from immutable body rendering. */
export async function getArticlePublication(
  locale: Locale,
  publicPath: string
) {
  "use cache";

  applyContentCache("article");
  // Start native IO before Effect during request-less static rendering.
  // https://nextjs.org/docs/messages/next-prerender-current-time
  const source = await fetchQuery(
    api.contentRelease.article.delivery,
    {
      appLocale: AppLocaleSchema.make(locale),
      publicPath,
    },
    { url: env.NEXT_PUBLIC_CONVEX_URL }
  );
  return await Effect.runPromise(
    decodeArticleDelivery(source, locale, publicPath)
  );
}

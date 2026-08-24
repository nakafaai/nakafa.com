import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { ContentRuntimeMissingError } from "@repo/backend/client/content/errors";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import {
  makeArticleProjectionError,
  verifyArticlePublication,
} from "@/lib/content/article/decode";
import { getPublishedArticleRoute } from "@/lib/content/article/route";
import {
  applyPublishedCatalogCache,
  applyPublishedContentCache,
} from "@/lib/content/cache";
import { renderCurrentPublishedArticle } from "@/lib/content/published/article";

/** Reads one coherent article shell and body without a sequential network waterfall. */
export async function getArticlePublication(
  locale: Locale,
  publicPath: string
) {
  "use cache";

  const appLocale = AppLocaleSchema.make(locale);
  const readPublished = Effect.tryPromise(() =>
    renderCurrentPublishedArticle({ appLocale, publicPath })
  ).pipe(
    Effect.catchIf(
      (failure) => failure.cause instanceof ContentRuntimeMissingError,
      () => Effect.succeed(null)
    )
  );
  const [model, published] = await Promise.all([
    getPublishedArticleRoute(locale, publicPath),
    Effect.runPromise(readPublished),
  ]);
  if (!model.projection) {
    applyPublishedCatalogCache("article");
    return null;
  }
  if (!published) {
    return await Effect.runPromise(
      Effect.fail(makeArticleProjectionError({ appLocale, publicPath }))
    );
  }
  await Effect.runPromise(
    verifyArticlePublication(
      {
        activeReleaseId: model.activeReleaseId,
        projection: model.projection,
      },
      published
    )
  );
  applyPublishedContentCache("article", published.artifactHash);
  return { model, published };
}

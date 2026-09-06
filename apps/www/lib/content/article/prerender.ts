import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { readPublishedCategories } from "@/lib/content/article/catalog";
import { readPublishedCategoryPage } from "@/lib/content/article/category";
import { PublishedProjectionError } from "@/lib/content/published/errors";

/** Selects one real article and category from two bounded, release-bound pages. */
export const readPublishedArticlePrerenderRoute = Effect.fn(
  "www.articles.readPrerenderRoute"
)(function* (locale: Locale) {
  const identity = {
    appLocale: AppLocaleSchema.make(locale),
    publicPath: "articles",
  };
  const categories = yield* readPublishedCategories({
    cursor: null,
    expectedManifestHash: null,
    expectedReleaseId: null,
    locale,
  });
  const category = categories.categories[0];
  if (categories.stale || !category) {
    return yield* new PublishedProjectionError(identity);
  }
  const page = yield* readPublishedCategoryPage(
    {
      ...category,
      activeManifestHash: categories.activeManifestHash,
      activeReleaseId: categories.activeReleaseId,
      appLocale: locale,
    },
    {
      cursor: null,
      expectedManifestHash: null,
      expectedReleaseId: null,
    }
  );
  const article = page.articles[0];
  if (
    page.stale ||
    page.activeManifestHash !== categories.activeManifestHash ||
    page.activeReleaseId !== categories.activeReleaseId ||
    page.sourceRevision !== categories.sourceRevision ||
    !article
  ) {
    return yield* new PublishedProjectionError(identity);
  }
  return article.route;
});

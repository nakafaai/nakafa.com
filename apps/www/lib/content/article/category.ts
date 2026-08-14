import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

/** Checks whether one category exists in the signed article catalog. */
export const hasPublishedArticleCategory = Effect.fn(
  "www.articles.hasCategory"
)(function* (category: string, locale: Locale) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* readRuntimeQuery(api.contentRelease.article.category, {
    appLocale,
    category,
  });
  if (!result.managed) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: `articles/${category}`,
    });
  }
  return result.exists;
});

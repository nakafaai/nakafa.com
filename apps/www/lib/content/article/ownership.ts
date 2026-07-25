import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

/** Resolves one exact category through its published article owner. */
export const readPublishedArticleCategory = Effect.fn(
  "www.articles.readCategoryOwnership"
)(function* (category: string, locale: Locale) {
  return yield* readRuntimeQuery("contentRelease.article.category", () =>
    fetchRuntimeQuery(api.contentRelease.article.category, {
      category,
      locale,
    })
  );
});

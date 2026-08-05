import { ArticleCategorySchema } from "@nakafa/aksara-contracts/projection/article";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { readPublishedCategoryArticles } from "@/lib/content/article/discovery";
import { buildPublishedContentLlmsEntries } from "@/lib/llms/entries";

const LLMS_LISTING_ENTRY_LIMIT = 100;

/**
 * Builds entries for one verified public content listing.
 *
 * Unsupported route shapes return null. Supported shapes read one bounded
 * catalog page and advertise only verified routes from the active owner.
 */
export const getContentListingLlmsEntries = Effect.fn(
  "www.llms.contentListingEntries"
)(function* ({ locale, route }: { locale: Locale; route: string }) {
  const cleanRoute = route.replace(/^\/+|\/+$/g, "");
  const category = readArticleListingCategory(cleanRoute);
  if (!category) {
    return null;
  }

  const published = yield* readPublishedCategoryArticles(
    locale,
    category,
    LLMS_LISTING_ENTRY_LIMIT
  );
  return buildPublishedContentLlmsEntries({
    locale,
    rows: published.articles,
    section: "articles",
  });
});

/** Parses one exact article listing through the current Aksara contract. */
function readArticleListingCategory(route: string) {
  const [root, category, ...remaining] = route.split("/").filter(Boolean);
  if (
    root !== "articles" ||
    remaining.length > 0 ||
    !Schema.is(ArticleCategorySchema)(category)
  ) {
    return null;
  }

  return category;
}

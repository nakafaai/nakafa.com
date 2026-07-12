import { getSlugPath } from "@repo/contents/_lib/articles/slug";
import type { ArticleCategory } from "@repo/contents/_types/taxonomy";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { fetchRuntimeArticlePage } from "@/lib/content/runtime/pages";

/** Loads one cached Convex article row for metadata and page rendering. */
export async function getArticlePageData({
  locale,
  category,
  slug,
}: {
  locale: Locale;
  category: ArticleCategory;
  slug: string;
}) {
  "use cache";

  applyContentRuntimeCache();

  const filePath = getSlugPath(category, slug);
  const content = await fetchRuntimeArticlePage({
    locale,
    slug: filePath.slice(1),
  });

  return { content, filePath };
}

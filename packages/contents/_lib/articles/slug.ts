import { teams } from "@repo/contents/_data/team";
import { getContentsMetadata } from "@repo/contents/_lib/metadata";
import { formatContentDateISO } from "@repo/contents/_shared/date";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";
import type { Article } from "@repo/contents/_types/content";
import { Effect } from "effect";
import type { Locale } from "next-intl";

/**
 * Builds the public URL path for an article detail page.
 *
 * @param category - Article category slug
 * @param slug - Article slug within the category
 * @returns Canonical article path
 */
export function getSlugPath(category: ArticleCategory, slug: string) {
  return `/articles/${category}/${slug}` as const;
}

/**
 * Loads article summaries for one category and sorts them newest-first.
 *
 * Metadata is read through the metadata-only listing path so category pages do
 * not import every article MDX module just to render article cards.
 *
 * @param category - Article category slug
 * @param locale - Locale to read article metadata for
 * @returns Article card summaries with metadata and official-author status
 *
 * @example
 * ```ts
 * const articles = await getArticleSummaries("politics", "en");
 * // Returns: [{ title, description, date, slug, official }, ...]
 * ```
 */
export async function getArticleSummaries(
  category: ArticleCategory,
  locale: Locale
): Promise<Article[]> {
  // Extract the actual category name if a full path is provided
  const categoryName = category.includes("/")
    ? category.split("/").pop()
    : category;

  if (!categoryName) {
    return [];
  }

  const categoryPrefix = `articles/${categoryName}/`;

  return await Effect.runPromise(
    getContentsMetadata({
      locale,
      basePath: categoryPrefix,
    }).pipe(
      Effect.map((entries) => {
        const articlesBySlug = new Map<string, Article>();

        for (const entry of entries) {
          if (!entry.slug.startsWith(categoryPrefix)) {
            continue;
          }

          const relativePath = entry.slug.slice(categoryPrefix.length);
          const slug = relativePath.split("/")[0];

          if (!slug || articlesBySlug.has(slug)) {
            continue;
          }

          const publishedAt = formatContentDateISO(entry.metadata.date);
          if (!publishedAt) {
            continue;
          }

          const authors = entry.metadata.authors.map((author) => author.name);

          articlesBySlug.set(slug, {
            title: entry.metadata.title,
            description: entry.metadata.description ?? "",
            date: publishedAt,
            slug,
            official: authors.some((author) => teams.has(author)),
          });
        }

        return Array.from(articlesBySlug.values()).sort((a, b) =>
          b.date.localeCompare(a.date)
        );
      })
    )
  );
}

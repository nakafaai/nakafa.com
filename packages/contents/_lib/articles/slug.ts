import { teams } from "@repo/contents/_data/team";
import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";
import {
  type Article,
  ContentMetadataSchema,
} from "@repo/contents/_types/content";
import { formatISO } from "date-fns";
import type { Locale } from "next-intl";

/**
 * Gets the path to an article based on its category and slug.
 * @param category - The category of the article.
 * @param slug - The slug of article.
 * @returns The path to the article.
 */
export function getSlugPath(category: ArticleCategory, slug: string) {
  return `/articles/${category}/${slug}` as const;
}

/**
 * Retrieves all articles for a given category, sorted by date (newest first).
 * Uses the MDX cache for efficient slug lookup and imports metadata directly.
 *
 * @param category - Article category (can be full path or category name)
 * @param locale - Target locale
 * @returns Array of article metadata with title, description, date, slug, and official status
 *
 * @example
 * ```ts
 * const articles = await getArticles("politics", "en");
 * // Returns: [{ title, description, date, slug, official }, ...]
 * ```
 */
export async function getArticles(
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

  // Get all article directories under the specified category using cache
  const allSlugs = getMDXSlugsForLocale(locale);
  const categoryPrefix = `articles/${categoryName}/`;

  const slugs = allSlugs
    .filter((slug: string) => slug.startsWith(categoryPrefix))
    .map((slug: string) => slug.slice(categoryPrefix.length).split("/")[0]);

  // Remove duplicates while preserving order
  const uniqueSlugs = Array.from(new Set(slugs));

  // Process the article data in a single pass
  const articles = await Promise.all(
    uniqueSlugs.map(async (slug: string) => {
      try {
        // Import the metadata directly
        const { metadata } = await import(
          `@repo/contents/articles/${categoryName}/${slug}/${locale}.mdx`
        );

        const parsedMetadata = ContentMetadataSchema.parse(metadata);

        const authors: string[] = parsedMetadata.authors.map(
          (author: { name: string }) => author.name
        );

        return {
          title: parsedMetadata.title,
          description: parsedMetadata.description || "",
          date: formatISO(parsedMetadata.date),
          slug,
          official: authors.some((author) => teams.has(author)),
        };
      } catch {
        // TODO: Add monitoring for missing articles
        return null;
      }
    })
  );

  // Filter out any null values and sort by date (newest first)
  return articles
    .filter((article) => article !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

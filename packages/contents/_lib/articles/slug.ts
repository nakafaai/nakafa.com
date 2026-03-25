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
 * Loads all articles in a category and sorts them newest-first.
 *
 * Metadata is imported directly from MDX modules while the cache is used to
 * discover available article slugs for the requested locale.
 *
 * @param category - Article category slug
 * @param locale - Locale to read article metadata for
 * @returns Article summaries with metadata and official-author status
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

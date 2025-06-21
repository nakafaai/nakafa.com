import { teams } from "@repo/contents/_data/team";
import { getFolderChildNames } from "@repo/contents/_lib/utils";
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
 * @param slug - The slug of the article.
 * @returns The path to the article.
 */
export function getSlugPath(category: ArticleCategory, slug: string) {
  return `/articles/${category}/${slug}` as const;
}

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

  // Get all article directories under the specified category using the utility function
  const slugs = getFolderChildNames(`contents/articles/${categoryName}`);

  // Process the article data in a single pass
  const articles = await Promise.all(
    slugs.map(async (slug) => {
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
          description: parsedMetadata.description,
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
    .filter((article): article is Article => article !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

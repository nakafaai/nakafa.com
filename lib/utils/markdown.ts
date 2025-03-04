import type { Article } from "@/types/articles";
import { compareDesc, parse } from "date-fns";
import glob from "fast-glob";
import { teams } from "../data/team";

// This function is still kept for backward compatibility
export function getHeadings(content: string): string[] {
  try {
    // Handle markdown style headings (# Heading)
    const markdownHeadingRegex = /^(#{1,6})\s+(.*)$/gm;
    const markdownMatches = Array.from(content.matchAll(markdownHeadingRegex));

    if (markdownMatches && markdownMatches.length > 0) {
      return markdownMatches.map((match) => match[2].trim());
    }

    // If we reach here, no headings found with markdown regex
    return [];
  } catch {
    return [];
  }
}

export async function getArticles(
  basePath: string,
  locale: string
): Promise<Article[]> {
  // Get all article directories that have a page.tsx file - use a simpler, more reliable pattern
  const articleDirs = await glob("*/page.tsx", {
    cwd: basePath,
    absolute: true, // Get absolute paths
  });

  // Extract unique slugs from the paths
  const articleSlugs = articleDirs
    .map((dir) => {
      // Get the parent directory name (slug)
      const parts = dir.split("/");
      return parts.at(-2); // Get the directory name before page.tsx
    })
    .filter((slug, index, self) => self.indexOf(slug) === index); // Remove duplicates

  // Get all the articles, sort by date and extract the title, description, and date
  const articles = await Promise.all(
    articleSlugs.map(async (slug) => {
      try {
        // Use template literals with the correct syntax for Next.js dynamic imports
        // This pattern is more reliable for Next.js production builds
        const { metadata } = await import(
          `@/app/[locale]/articles/${basePath.split("/").at(-1)}/${slug}/${locale}.mdx`
        );

        const authors: string[] = metadata.authors.map(
          (author: { name: string }) => author.name
        );

        return {
          title: metadata.title,
          description: metadata.description,
          date: metadata.date,
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
  const sortedArticles = articles
    .filter((article): article is Article => article !== null)
    .sort((a, b) => {
      const dateA = parse(a.date, "MM/dd/yyyy", new Date());
      const dateB = parse(b.date, "MM/dd/yyyy", new Date());
      return compareDesc(dateA, dateB);
    });

  return sortedArticles;
}

import fs from "node:fs/promises";
import path from "node:path";
import type { ParsedHeading } from "@/components/shared/sidebar-tree";
import type { ArticleCategory } from "@/types/articles/category";
import type { Article, ContentPagination } from "@/types/content";
import type { MaterialList } from "@/types/subject/material";
import { compareDesc, parse } from "date-fns";
import type { Locale } from "next-intl";
import { Children } from "react";
import type { ReactNode } from "react";
import { teams } from "../data/team";
import { getFolderChildNames } from "./system";

/**
 * Reads the raw content of a file, use app/[locale] as the base path.
 * @param path - The path to the file.
 * @returns The raw content of the file.
 */
export async function getRawContent(filePath: string): Promise<string> {
  return fs
    .readFile(path.join(process.cwd(), "contents", filePath), "utf8")
    .catch(() => {
      return "";
    });
}

/**
 * Parses the headings from the content.
 * @param content - Markdown content to parse.
 * @returns The parsed headings.
 */
export function getHeadings(content: string): ParsedHeading[] {
  try {
    // Handle markdown style headings (# Heading)
    const markdownHeadingRegex = /^(#{1,6})\s+(.*)$/gm;
    const markdownMatches = Array.from(content.matchAll(markdownHeadingRegex));

    if (markdownMatches && markdownMatches.length > 0) {
      const headings: ParsedHeading[] = [];
      // Keep track of the last heading seen at each level
      const lastHeadingAtLevel: ParsedHeading[] = new Array(7); // 0-6 levels (0 unused)

      for (const match of markdownMatches) {
        const level = match[1].length; // Number of # symbols
        const text = match[2].trim();
        const slug = text.toLowerCase().replace(/\s+/g, "-");

        const heading: ParsedHeading = {
          label: text,
          href: `#${slug}`,
          children: [],
        };

        // Store the current heading at its level
        lastHeadingAtLevel[level] = heading;

        if (level === 1) {
          // Top level headings
          headings.push(heading);
        } else {
          // Find the parent heading (the closest heading with a lower level)
          let parentLevel = level - 1;
          while (parentLevel > 0 && !lastHeadingAtLevel[parentLevel]) {
            parentLevel--;
          }

          // If a parent was found, add this heading as its child
          if (parentLevel > 0 && lastHeadingAtLevel[parentLevel]) {
            const parent = lastHeadingAtLevel[parentLevel];
            if (!parent.children) {
              parent.children = [];
            }
            parent.children.push(heading);
          } else {
            // No parent found, add to top level
            headings.push(heading);
          }
        }
      }

      // Clean up empty children arrays
      const cleanupChildren = (items: ParsedHeading[]): void => {
        for (const item of items) {
          if (item.children && item.children.length === 0) {
            // Set to undefined instead of using delete
            item.children = undefined;
          } else if (item.children) {
            cleanupChildren(item.children);
          }
        }
      };

      cleanupChildren(headings);
      return headings;
    }

    // If we reach here, no headings found with markdown regex
    return [];
  } catch {
    return [];
  }
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
          `@/contents/articles/${categoryName}/${slug}/${locale}.mdx`
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
  return articles
    .filter((article): article is Article => article !== null)
    .sort((a, b) => {
      const dateA = parse(a.date, "MM/dd/yyyy", new Date());
      const dateB = parse(b.date, "MM/dd/yyyy", new Date());
      return compareDesc(dateA, dateB);
    });
}

/**
 * Filters whitespace text nodes from the given children to prevent hydration errors.
 * @param children - The children to filter.
 * @returns The filtered children.
 */
export function filterWhitespaceNodes(children: ReactNode) {
  return Children.toArray(children).filter(
    (child) => !(typeof child === "string" && child.trim() === "")
  );
}

/**
 * Gets the previous and next materials for pagination based on the current path.
 *
 * @param currentPath - The current path/URL being viewed
 * @param materials - List of material subjects and their items
 * @returns Object containing previous and next navigation items with empty strings if not available
 *
 * Time Complexity: O(n) where n is total number of items across all subjects
 */
export function getMaterialsPagination(
  currentPath: string,
  materials: MaterialList
): ContentPagination {
  // Default empty navigation item
  const emptyItem = { href: "", title: "" };

  // Flatten all items from all subjects into a single array with subject information
  const allItems = materials.flatMap((subject) =>
    subject.items.map((item) => ({
      ...item,
    }))
  );

  // Find the index of the current item in the flattened array
  const currentIndex = allItems.findIndex((item) => item.href === currentPath);

  // If the current path is not found, return empty items
  if (currentIndex === -1) {
    return { prev: emptyItem, next: emptyItem };
  }

  // Extract navigation data from an item or return empty values if not available
  const getItemData = (item: (typeof allItems)[number] | null) =>
    item ? { href: item.href, title: item.title } : emptyItem;

  // Get previous and next items based on current index
  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null;
  const nextItem =
    currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null;

  return {
    prev: getItemData(prevItem),
    next: getItemData(nextItem),
  };
}

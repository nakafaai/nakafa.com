import fs from "node:fs/promises";
import path from "node:path";
import type { ParsedHeading } from "@/components/shared/sidebar-tree";
import { Children } from "react";
import type { ReactNode } from "react";

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

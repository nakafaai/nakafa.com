import type { ParsedHeading } from "@repo/contents/_types/toc";
import {
  createHeadingId,
  createHeadingLabel,
} from "@repo/design-system/lib/utils";

const HEADING_LEVELS = 6;

/**
 * Extracts heading hierarchy from markdown content.
 * Parses markdown headings (h1-h6) and builds a nested structure for TOC generation.
 * Removes code blocks before parsing to avoid false matches.
 *
 * @param content - Raw markdown content
 * @returns Array of parsed headings with nested children
 *
 * @example
 * ```ts
 * const headings = getHeadings("# Introduction\\n## Getting Started");
 * // Returns: [{ label: "Introduction", href: "#introduction", children: [...] }]
 * ```
 */
export function getHeadings(content: string): ParsedHeading[] {
  const cleanedContent = content
    .replace(/<CodeBlock[\s\S]*?\/>/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/~~~[\s\S]*?~~~/g, "");

  const markdownHeadingRegex = /^\s*(#{1,6})(?:\s+(.*))?$/gm;
  const markdownMatches = Array.from(
    cleanedContent.matchAll(markdownHeadingRegex)
  );

  if (markdownMatches && markdownMatches.length > 0) {
    const headings: ParsedHeading[] = [];
    const lastHeadingAtLevel: ParsedHeading[] = new Array(HEADING_LEVELS + 1);

    for (const match of markdownMatches) {
      const level = match[1].length;
      const text = match[2] ? match[2].trim() : "";
      const slug = createHeadingId(text);

      const heading: ParsedHeading = {
        label: createHeadingLabel(text),
        href: `#${slug}`,
        children: [],
      };

      lastHeadingAtLevel[level] = heading;

      if (level === 1) {
        headings.push(heading);
      } else {
        let parentLevel = level - 1;
        while (parentLevel > 0 && !lastHeadingAtLevel[parentLevel]) {
          parentLevel -= 1;
        }

        if (parentLevel > 0 && lastHeadingAtLevel[parentLevel]) {
          lastHeadingAtLevel[parentLevel].children.push(heading);
        } else {
          headings.push(heading);
        }
      }
    }

    return headings;
  }

  return [];
}

/**
 * Extracts all heading IDs from a parsed heading hierarchy.
 * Uses iterative DFS traversal to collect all heading slugs including nested children.
 *
 * @param headings - Array of parsed headings with potential nested children
 * @returns Array of heading slugs/IDs
 *
 * @example
 * ```ts
 * const ids = extractAllHeadingIds(headings);
 * // Returns: ["introduction", "getting-started", "installation"]
 * ```
 */
export function extractAllHeadingIds(headings: ParsedHeading[]): string[] {
  const ids: string[] = [];
  const stack: ParsedHeading[] = [...headings].reverse();
  let stackIndex = stack.length - 1;

  while (stackIndex >= 0) {
    const heading = stack[stackIndex];
    stack.splice(stackIndex, 1);

    ids.push(createHeadingId(heading.label));

    if (heading.children && heading.children.length > 0) {
      stack.splice(stackIndex, 0, ...[...heading.children].reverse());
    }

    stackIndex = stack.length - 1;
  }

  return ids;
}

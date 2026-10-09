import { createHeadingId, createHeadingLabel } from "@repo/math/heading";
import { Array as Arr, Schema } from "effect";

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
  const entries = Arr.map(
    Arr.fromIterable(cleanedContent.matchAll(markdownHeadingRegex)),
    (match) => {
      const text = match[2]?.trim() ?? "";
      return {
        href: `#${createHeadingId(text)}`,
        label: createHeadingLabel(text),
        level: match[1].length,
      };
    }
  );
  return nestHeadings(entries);
}

/** A heading in document order, before its children are nested under it. */
const HeadingEntrySchema = Schema.Struct({
  href: Schema.String,
  label: Schema.String,
  level: Schema.Finite,
});

type HeadingEntry = typeof HeadingEntrySchema.Type;

/**
 * Nests each entry under the nearest earlier entry with a smaller level. An
 * entry with no such earlier entry starts a sibling run, and the entries after
 * it, up to the next run, are its descendants.
 */
function nestHeadings(entries: readonly HeadingEntry[]): ParsedHeading[] {
  const starts = siblingStarts(entries);
  const ends = Arr.append(Arr.drop(starts, 1), entries.length);
  return Arr.map(Arr.zip(starts, ends), ([start, end]) => {
    const entry = entries[start];
    return {
      label: entry.label,
      href: entry.href,
      children: nestHeadings(
        Arr.take(Arr.drop(entries, start + 1), end - start - 1)
      ),
    };
  });
}

/** Lists the indexes of the entries with no earlier entry of a smaller level. */
function siblingStarts(entries: readonly HeadingEntry[]) {
  // shallowestBefore[index] is the smallest level among the entries before it.
  const shallowestBefore = Arr.scan(
    entries,
    Number.POSITIVE_INFINITY,
    (shallowest, entry) => Math.min(shallowest, entry.level)
  );
  return Arr.filter(
    Arr.map(entries, (_entry, index) => index),
    (index) => entries[index].level <= shallowestBefore[index]
  );
}

/**
 * Extracts all heading IDs from a parsed heading hierarchy.
 * Uses a depth-first traversal to collect all heading slugs including nested children.
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
  return Arr.flatMap(headings, (heading) => [
    createHeadingId(heading.label),
    ...extractAllHeadingIds(heading.children),
  ]);
}

export const ParsedHeadingSchema = Schema.Struct({
  children: Schema.Array(
    Schema.suspend((): Schema.Codec<ParsedHeading> => ParsedHeadingSchema)
  ).pipe(Schema.mutable),
  href: Schema.String,
  index: Schema.optionalKey(Schema.Finite),
  label: Schema.String,
});

type ParsedHeadingFields = typeof ParsedHeadingSchema.Type;

/**
 * One heading in the table of contents. The interface only names the recursive
 * shape; every field is derived from `ParsedHeadingSchema`.
 */
export interface ParsedHeading extends ParsedHeadingFields {}

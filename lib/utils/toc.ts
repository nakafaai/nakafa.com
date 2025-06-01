import type { ParsedHeading } from "@/types/toc";
import { slugify } from ".";

export function extractAllHeadingIds(headings: ParsedHeading[]): string[] {
  const ids: string[] = [];

  for (const heading of headings) {
    ids.push(slugify(heading.label));

    if (heading.children && heading.children.length > 0) {
      ids.push(...extractAllHeadingIds(heading.children));
    }
  }

  return ids;
}

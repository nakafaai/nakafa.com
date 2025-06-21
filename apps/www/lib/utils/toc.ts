import type { ParsedHeading } from "@repo/contents/_types/toc";
import { slugify } from "@repo/design-system/lib/utils";

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

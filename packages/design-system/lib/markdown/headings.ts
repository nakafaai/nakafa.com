import { slugify } from "@repo/design-system/lib/routing/slug";

/** Produces the stable anchor used by rendered Markdown headings. */
export function createHeadingId(text: string) {
  return slugify(createHeadingLabel(text));
}

/** Removes MDX markup while retaining readable heading text. */
export function createHeadingLabel(text: string) {
  return text
    .replace(/<InlineMath[^>]*math="([^"]*)"[^>]*\/>/g, "$1")
    .replace(/<BlockMath[^>]*math="([^"]*)"[^>]*\/>/g, "$1")
    .replace(/<CodeBlock[^>]*\/>/g, "[Code]")
    .replace(/<[^>]*>/g, "")
    .replace(/\\([a-zA-Z]+)/g, "$1")
    .trim();
}

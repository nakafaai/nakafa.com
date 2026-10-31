import { toAnchorSlug } from "@repo/utilities/slug";

/** Produces the stable anchor used by rendered Markdown headings. */
export function createHeadingId(text: string) {
  return toAnchorSlug(createHeadingLabel(text));
}

/** Removes MDX markup while retaining readable heading text. */
export function createHeadingLabel(text: string) {
  return text
    .replace(/<InlineMath[^>]*math="(?<math>[^"]*)"[^>]*\/>/gu, "$1")
    .replace(/<BlockMath[^>]*math="(?<math>[^"]*)"[^>]*\/>/gu, "$1")
    .replace(/<CodeBlock[^>]*\/>/gu, "[Code]")
    .replace(/<[^>]*>/gu, "")
    .replace(/\\(?<command>[a-zA-Z]+)/gu, "$1")
    .trim();
}

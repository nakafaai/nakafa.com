import { slugify } from "@repo/design-system/lib/routing/slug";
import { cva } from "class-variance-authority";

/**
 * Styling for the text inside one rendered heading.
 *
 * The rule under the words marks where a section starts, so the top two
 * heading levels carry it. Deeper levels stay plain ink so the level
 * hierarchy reads at a glance.
 */
export const headingTextVariants = cva(
  "wrap-anywhere hyphens-auto text-pretty text-primary",
  {
    variants: {
      rule: {
        none: "",
        section:
          "underline decoration-2 decoration-heading-rule underline-offset-4",
      },
    },
    defaultVariants: {
      rule: "none",
    },
  }
);

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

import { cva } from "class-variance-authority";

/*
 * The classes of a published article's text, which the exam editor, the student's reader and the
 * teacher's preview draw a question with too, so a question reads as a lesson reads. Each class
 * string of an article's text lives here and nowhere else.
 */

/** A paragraph, whose lines stop at about 75 characters. */
export const paragraphVariants = cva(
  "my-4 max-w-xl text-pretty tabular-nums leading-relaxed first:mt-0 last:mb-0"
);

/** A heading's box: its room above and below, and the size of its level. */
export const headingVariants = cva(
  "mt-10 mb-6 font-medium leading-tight tracking-tight first:mt-0 last:mb-0",
  {
    variants: {
      tag: {
        h1: "text-3xl",
        h2: "text-2xl",
        h3: "text-xl",
        h4: "text-lg",
        h5: "text-lg",
        h6: "text-lg",
      },
    },
  }
);

/**
 * A heading's words. The rule under the words marks where a section starts, so the top two heading
 * levels carry it, and deeper levels stay plain ink, so the level hierarchy reads at a glance.
 */
export const headingTextVariants = cva(
  "wrap-anywhere hyphens-auto text-pretty text-primary",
  {
    variants: {
      tag: {
        h1: "underline decoration-2 decoration-heading-rule underline-offset-4",
        h2: "underline decoration-2 decoration-heading-rule underline-offset-4",
        h3: "",
        h4: "",
        h5: "",
        h6: "",
      },
    },
  }
);

/** A list, numbered or bulleted, with room between its items. */
export const listVariants = cva("my-4 space-y-4 ps-8 last:mb-0", {
  variants: {
    kind: {
      bullet: "list-disc",
      ordered: "list-decimal",
    },
  },
});

/** One item of a list, whose first paragraph sits on the marker's line. */
export const listItemVariants = cva(
  "max-w-xl text-pretty pl-1 leading-relaxed [&>*+*]:mt-4 [&>p:first-child]:inline"
);

/** A quotation, on the muted callout surface. */
export const quoteVariants = cva(
  "my-4 rounded-r-xl border-foreground border-l-2 bg-muted p-4 italic"
);

/** Code inside a line of text. */
export const codeVariants = cva(
  "inline whitespace-pre-wrap break-all rounded-sm border bg-muted px-1 py-0.5 font-mono text-muted-foreground text-sm tracking-tight"
);

/**
 * A block that draws its own frame, such as a code block, a table, a picture or a formula on its own
 * line: the room an article leaves around it.
 */
export const blockGapVariants = cva("my-4 first:mt-0 last:mb-0");

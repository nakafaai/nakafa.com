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
 * A table's frame: rounded and bordered, scrolling sideways when the table is wider, its words in the small
 * size, its table as wide as the frame (`*:w-full`), and its body on the muted surface. The lesson draws the
 * frame as the table's container, the exam editor as its table's wrapper, so both select the body alike.
 */
export const tableFrameVariants = cva(
  "relative my-4 grid w-full grid-cols-1 overflow-x-auto rounded-xl border text-sm *:w-full first:mt-0 last:mb-0 [&_tbody]:bg-muted/40"
);

/** A row of a table, with a rule under every row but the last. */
export const tableRowVariants = cva("border-b last:border-b-0");

/**
 * A heading cell of a table, on the header's stronger muted surface, its words aligned to the start of the
 * cell's direction, so an Arabic heading sits on the right.
 */
export const tableHeadCellVariants = cva(
  "h-10 whitespace-nowrap border-r bg-muted/80 px-4 text-start align-middle font-medium last:border-r-0"
);

/** A data cell of a table, with a rule between it and the next column. */
export const tableCellVariants = cva(
  "wrap-anywhere border-r px-4 py-2 align-middle last:border-r-0"
);

/**
 * A block that draws its own frame, such as a code block, a table, a picture or a formula on its own
 * line: the room an article leaves around it.
 */
export const blockGapVariants = cva("my-4 first:mt-0 last:mb-0");

/** A formula on its own line: the card that holds it. */
export const mathBlockVariants = cva(
  "overflow-hidden rounded-xl border bg-card text-card-foreground"
);

/** The row of a formula card, which scrolls sideways when the formula is wider than the card. */
export const mathScrollVariants = cva("overflow-x-auto overflow-y-hidden px-4");

/**
 * A formula inside a line of text. KaTeX cuts the formula after each relation and binary operator on
 * its outer level, and each piece is one `.katex-base`. The pieces are the boxes of the line, so the
 * text after a formula continues after its last piece. A piece wider than the column scrolls sideways
 * in its own box, which is `inline-flex` because an `inline-block` with `overflow` takes its bottom
 * edge as its baseline. The padding and the negative margin cancel for layout and leave the ink of a
 * root or an underbrace room, which `overflow` would otherwise clip. Its widest is the column plus that
 * padding: a box that may only be as wide as the column would lose the padding's width from its text
 * wherever the column is as wide as the formula, as a table cell is. The strut KaTeX puts in each piece
 * to hold the formula's height and depth is taken out of flow, so a piece keeps the baseline and the
 * line height of the text around it.
 */
export const mathInlineVariants = cva(
  "[&_.katex-html>.katex-base]:inline-flex! [&_.katex-html>.katex-base>.katex-strut]:absolute [&_.katex-html>.katex-base]:-m-1 [&_.katex-html>.katex-base]:max-w-[calc(100%+0.5rem)] [&_.katex-html>.katex-base]:items-baseline [&_.katex-html>.katex-base]:overflow-x-auto [&_.katex-html>.katex-base]:overflow-y-hidden [&_.katex-html>.katex-base]:p-1"
);

/** The colour of a formula KaTeX cannot draw: muted, so a broken formula reads as a slip, not an alarm. */
export const MATH_ERROR_COLOR = "var(--color-muted-foreground)";

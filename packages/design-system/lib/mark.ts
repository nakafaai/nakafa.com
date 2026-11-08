import { cva } from "class-variance-authority";

/**
 * The room of a marker beside words, such as a number, a circle, a check box, a dot, an icon or an icon button. Its
 * `line` size is one line of the words high, for an icon in a line of text such as a thought's spinner or a task's
 * check box. Its `control` size is the band of a marked line: a control high (2rem), or one line of the words when
 * that is taller, so a 32 pixel button fits it whole and every marker stands on the middle of the words' first line
 * (`lineWords`). A `letter` holds a number or a letter, at the end of a column one width wide, so the words of every
 * row of a list start on one line.
 */
export const lineMark = cva("flex shrink-0 items-center", {
  defaultVariants: { letter: false, size: "line" },
  variants: {
    letter: {
      false: "",
      true: "justify-end font-medium tabular-nums",
    },
    size: {
      control: "h-[max(--spacing(8),1lh)]",
      line: "h-lh",
    },
  },
  compoundVariants: [
    { class: "min-w-8 justify-center", letter: false, size: "control" },
    { class: "min-w-5", letter: true, size: "control" },
  ],
});

/**
 * The words beside the markers of a control band: padded so their first line stands on the band's middle, and their
 * last line as far from the row's edge, so a row of one line is exactly one band high.
 */
export const lineWords = cva(
  "min-w-0 flex-1 py-[max(0px,calc((--spacing(8)-1lh)/2))]"
);

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { buttonVariants } from "@repo/design-system/lib/button";
import { lineMark, lineWords } from "@repo/design-system/lib/mark";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

/** The surface of each outlined tone: the button variant that draws it. */
const SURFACES = {
  chosen: "default-outline",
  correct: "success-outline",
  idle: "outline",
  wrong: "destructive-outline",
} as const;

/**
 * The layout of a marked line: its parts from the top, one gap between them, and on an outlined tone a padding equal
 * to that gap on every side, so a row of one line is one control band high plus the same room above and below. Its
 * words take the base size and stand on the side the set reads from, whatever each line is written in.
 */
const markedLine = cva("flex min-w-0 items-start gap-2", {
  defaultVariants: { framed: true, written: false },
  variants: {
    framed: {
      false: "",
      true: "h-auto w-full flex-1 shrink justify-start p-2 text-base font-normal whitespace-normal ltr:text-left rtl:text-right",
    },
    written: {
      false: "",
      true: "cursor-text select-text",
    },
  },
});

/**
 * One marked line: a marker, the words it names, and what stands at its end, such as a remove control, all on the
 * words' first line however many lines they wrap to. An outlined tone draws the row as an answer: open (`idle`),
 * chosen, correct or wrong; `bare` draws only the parts, for a row inside a table's cell. `written` marks a row whose
 * words are edited in place, so a press places the caret. It renders a `div`, or the element `render` names, such as
 * the `label` of a choice whose circle it holds. Compose `LineMark` and `LineWords` inside it.
 */
export function MarkedLine({
  className,
  render,
  tone = "idle",
  written = false,
  ...props
}: useRender.ComponentProps<"div"> & {
  readonly tone?: "bare" | keyof typeof SURFACES;
  readonly written?: boolean;
}) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          tone === "bare" ? "" : buttonVariants({ variant: SURFACES[tone] }),
          markedLine({ framed: tone !== "bare", written }),
          className
        ),
      },
      props
    ),
    render,
    state: { slot: "marked-line", tone },
  });
}

/**
 * The band of one marker of a marked line, a control high: a circle, a check box, a dot, an icon button, or, as a
 * `letter`, the number or letter that names the row, at the end of a column one width wide.
 */
export function LineMark({
  className,
  letter = false,
  ...props
}: ComponentProps<"span"> & {
  /** Whether the band holds the number or letter that names the row. */
  readonly letter?: boolean;
}) {
  return (
    <span
      className={cn(lineMark({ letter, size: "control" }), className)}
      data-slot="line-mark"
      {...props}
    />
  );
}

/** The words of a marked line, their first line on the middle of its markers' band. */
export function LineWords({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(lineWords(), className)}
      data-slot="line-words"
      {...props}
    />
  );
}

import { MathFontPreload } from "@repo/design-system/components/markdown/fonts";
import {
  ScrollArea,
  ScrollBar,
} from "@repo/design-system/components/ui/scroll-area";
import { readMathFonts } from "@repo/design-system/lib/markdown/fonts";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import katex from "katex";
import type { HTMLAttributes } from "react";

type MathComponentProps =
  | {
      readonly children?: never;
      readonly errorColor?: string;
      readonly math: string;
    }
  | {
      readonly children: string;
      readonly errorColor?: string;
      readonly math?: never;
    };

type KatexMarkupProps = MathComponentProps & {
  readonly displayMode: boolean;
};

function KatexMarkup({
  children,
  displayMode,
  errorColor = "var(--color-muted-foreground)",
  math,
}: KatexMarkupProps) {
  const html = katex.renderToString(math ?? children, {
    displayMode,
    errorColor,
    throwOnError: false,
    trust: false,
  });
  const fonts = readMathFonts(html);

  if (displayMode) {
    return (
      <>
        <MathFontPreload fonts={fonts} />
        <div
          // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX generates safe HTML while trust remains disabled.
          dangerouslySetInnerHTML={{ __html: html }}
          data-testid="katex"
        />
      </>
    );
  }

  return (
    <>
      <MathFontPreload fonts={fonts} />
      <span
        // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX generates safe HTML while trust remains disabled.
        dangerouslySetInnerHTML={{ __html: html }}
        data-testid="katex"
      />
    </>
  );
}

/**
 * Groups consecutive math blocks into one stacked card.
 *
 * Use this in MDX whenever multiple BlockMath rows are part of the same
 * derivation. The stack keeps one shared outer radius while each row remains
 * horizontally scrollable. Math renders in full with the page: a skipped
 * block would first take a placeholder height and move the text around it.
 */
export function MathContainer({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "my-4 space-y-0 last:mb-0 *:data-math-block:rounded-none *:data-math-block:border-b-0 [&>[data-math-block]:first-child]:rounded-t-xl [&>[data-math-block]:last-child]:rounded-b-xl [&>[data-math-block]:last-child]:border-b",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Renders one block-math card with native horizontal scrolling for wide
 * formulas.
 *
 * MathContainer uses the data-math-block presence marker to style adjacent
 * rows without coupling the stack to implementation-specific class names.
 */
export function BlockMath({
  className,
  ...props
}: MathComponentProps & { className?: string }) {
  // Empty string keeps this as a presence marker instead of data-math-block="true".
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card text-card-foreground",
        className
      )}
      data-markdown-ignore=""
      data-math-block=""
    >
      <ScrollArea className="grid">
        <div className="px-4">
          <KatexMarkup displayMode={true} {...props} />
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

/**
 * How an inline formula sits in a line of text.
 *
 * KaTeX breaks a formula after a relation or a binary operator on the outer
 * level, as TeX does, and never inside a fraction, a root or a
 * `\left ... \right` pair. One piece that cannot break can be wider than the
 * column, so `scroll` puts the formula in a box that is no wider than the
 * column and scrolls sideways when a piece does not fit. A formula that can
 * break wraps inside the box and stays whole.
 *
 * The box is one unit of its line. A formula wider than the column therefore
 * starts a line of its own, and the text after it continues beside its first
 * row.
 *
 * The box scrolls natively, as the table of a response does, and takes the
 * thin scrollbar of the global styles. A `ScrollArea` is made of divs, which
 * a paragraph cannot hold.
 *
 * The box is `inline-flex` because an `inline-block` with `overflow` takes its
 * bottom edge as its baseline and drops the formula off the text. The padding
 * and the negative margin cancel for layout and leave room for the ink that
 * sticks out of a formula's box, such as a root's tail. Measured in Chromium
 * over 19 formulas that fit: with them none scrolls and none paints
 * differently from the bare formula, and without them a root, an underbrace
 * and an integral scroll by 2 pixels and five formulas paint differently.
 */
const inlineMathVariants = cva("", {
  variants: {
    overflow: {
      scroll:
        "-m-1 inline-flex max-w-full overflow-x-auto overflow-y-hidden p-1",
      visible: "",
    },
  },
  defaultVariants: { overflow: "visible" },
});

/**
 * Renders one inline KaTeX expression.
 */
export function InlineMath({
  overflow,
  ...props
}: MathComponentProps & VariantProps<typeof inlineMathVariants>) {
  return (
    <span className={inlineMathVariants({ overflow })} data-markdown-ignore="">
      <KatexMarkup displayMode={false} {...props} />
    </span>
  );
}

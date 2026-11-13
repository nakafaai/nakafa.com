import {
  DrawnBlockMath,
  DrawnInlineMath,
} from "@repo/design-system/components/markdown/drawn";
import { MathFontPreload } from "@repo/design-system/components/markdown/fonts";
import { drawMath } from "@repo/design-system/lib/markdown/draw";
import { readMathFonts } from "@repo/design-system/lib/markdown/fonts";
import {
  mathBlockVariants,
  mathScrollVariants,
} from "@repo/design-system/lib/prose";
import { cn } from "cn";
import type { HTMLAttributes, ReactNode } from "react";

/** A formula as MDX writes it: its TeX in `math` or as its text. */
export type MathComponentProps =
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
  errorColor,
  math,
}: KatexMarkupProps) {
  const html = drawMath(math ?? children, displayMode, errorColor);

  return (
    <>
      <MathFontPreload fonts={readMathFonts(html)} />
      {displayMode ? (
        <DrawnBlockMath html={html} />
      ) : (
        <DrawnInlineMath html={html} />
      )}
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
 * formulas, as code blocks and inline formulas scroll, under the page's own
 * scrollbar style. A lesson draws dozens of these, so the card is plain markup:
 * no client component hydrates, measures or registers anything for it.
 *
 * MathContainer uses the data-math-block presence marker to style adjacent
 * rows without coupling the stack to implementation-specific class names.
 */
export function BlockMath({
  className,
  ...props
}: MathComponentProps & { className?: string }) {
  return (
    <MathBlockFrame className={className}>
      <KatexMarkup displayMode={true} {...props} />
    </MathBlockFrame>
  );
}

/** The card of one block formula, around the formula it scrolls. */
export function MathBlockFrame({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string | undefined;
}) {
  // Empty string keeps this as a presence marker instead of data-math-block="true".
  return (
    <div
      className={cn(mathBlockVariants(), className)}
      data-markdown-ignore=""
      data-math-block=""
    >
      <div className={mathScrollVariants()} data-slot="math-scroll">
        {children}
      </div>
    </div>
  );
}

/** Renders one inline KaTeX expression, drawn through `DrawnInlineMath`. */
export function InlineMath(props: MathComponentProps) {
  return <KatexMarkup displayMode={false} {...props} />;
}

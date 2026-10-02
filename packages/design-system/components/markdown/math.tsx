import { Formula } from "@repo/design-system/components/markdown/formula";
import {
  ScrollArea,
  ScrollBar,
} from "@repo/design-system/components/ui/scroll-area";
import { packMathMarkup } from "@repo/design-system/lib/markdown/markup";
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

/** Renders one formula with KaTeX and packs its markup for the leaf. */
function packFormula(
  {
    children,
    errorColor = "var(--color-muted-foreground)",
    math,
  }: MathComponentProps,
  displayMode: boolean
) {
  return packMathMarkup(
    katex.renderToString(math ?? children, {
      displayMode,
      errorColor,
      throwOnError: false,
      trust: false,
    })
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
      data-math-block=""
    >
      <ScrollArea className="grid">
        <div className="px-4">
          <Formula display="block" markup={packFormula(props, true)} />
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

/**
 * Renders one inline KaTeX expression.
 */
export function InlineMath(props: MathComponentProps) {
  return <Formula markup={packFormula(props, false)} />;
}

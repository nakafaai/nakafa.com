import {
  ScrollArea,
  ScrollBar,
} from "@repo/design-system/components/ui/scroll-area";
import { cn } from "@repo/design-system/lib/utils";
import { cva } from "class-variance-authority";
import { Children, type HTMLAttributes, isValidElement } from "react";
import {
  BlockMath as BlockMathReactKatex,
  InlineMath as InlineMathReactKatex,
  type MathComponentProps,
} from "react-katex";

const COMPACT_MATH_STACK_BLOCK_LIMIT = 2;
const SPACIOUS_MATH_STACK_BLOCK_START = 5;

const mathContainerVariants = cva(
  "my-4 space-y-0 last:mb-0 *:data-math-block:rounded-none *:data-math-block:border-b-0 [&>[data-math-block]:first-child]:rounded-t-xl [&>[data-math-block]:last-child]:rounded-b-xl [&>[data-math-block]:last-child]:border-b",
  {
    variants: {
      visibility: {
        compact: "content-auto-math-stack-compact",
        default: "content-auto-math-stack",
        spacious: "content-auto-math-stack-spacious",
      },
    },
    defaultVariants: {
      visibility: "default",
    },
  }
);

const blockMathVariants = cva(
  "overflow-hidden rounded-xl border bg-card text-card-foreground content-auto-formula"
);

/**
 * Renders one KaTeX block without the surrounding card shell.
 */

export function BlockMathKatex(props: MathComponentProps) {
  return (
    <BlockMathReactKatex
      errorColor="var(--color-muted-foreground)"
      {...props}
    />
  );
}

/**
 * Groups consecutive math blocks into one stacked card.
 *
 * Use this in MDX whenever multiple BlockMath rows are part of the same
 * derivation. The stack keeps one shared outer radius while each row remains
 * horizontally scrollable.
 *
 * @see https://web.dev/articles/content-visibility
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/contain-intrinsic-size
 */
export function MathContainer({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const blockCount = Children.toArray(children).filter(isValidElement).length;

  if (blockCount <= COMPACT_MATH_STACK_BLOCK_LIMIT) {
    return (
      <div
        className={cn(
          mathContainerVariants({ visibility: "compact" }),
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (blockCount >= SPACIOUS_MATH_STACK_BLOCK_START) {
    return (
      <div
        className={cn(
          mathContainerVariants({ visibility: "spacious" }),
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={cn(mathContainerVariants(), className)} {...props}>
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
    <div className={cn(blockMathVariants(), className)} data-math-block="">
      <ScrollArea className="grid">
        <div className="px-4">
          <BlockMathReactKatex
            errorColor="var(--color-muted-foreground)"
            {...props}
          />
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
  return (
    <InlineMathReactKatex
      errorColor="var(--color-muted-foreground)"
      {...props}
    />
  );
}

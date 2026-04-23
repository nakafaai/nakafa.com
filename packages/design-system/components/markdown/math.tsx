import {
  ScrollArea,
  ScrollBar,
} from "@repo/design-system/components/ui/scroll-area";
import { cn } from "@repo/design-system/lib/utils";
import { Children, type HTMLAttributes, isValidElement } from "react";
import {
  BlockMath as BlockMathReactKatex,
  InlineMath as InlineMathReactKatex,
  type MathComponentProps,
} from "react-katex";

const COMPACT_MATH_STACK_BLOCK_LIMIT = 2;
const SPACIOUS_MATH_STACK_BLOCK_START = 5;

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
 * Groups consecutive math blocks with the shared vertical spacing.
 */
export function MathContainer({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const blockCount = Children.toArray(children).filter(isValidElement).length;
  let visibilityClass = "content-auto-math-stack";

  if (blockCount <= COMPACT_MATH_STACK_BLOCK_LIMIT) {
    visibilityClass = "content-auto-math-stack-compact";
  }

  if (blockCount >= SPACIOUS_MATH_STACK_BLOCK_START) {
    visibilityClass = "content-auto-math-stack-spacious";
  }

  return (
    <div
      className={cn("my-4 space-y-4 last:mb-0", visibilityClass, className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Renders one block-math card with native horizontal scrolling for wide
 * formulas.
 */
export function BlockMath({
  className,
  ...props
}: MathComponentProps & { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card text-card-foreground content-auto-formula",
        className
      )}
    >
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

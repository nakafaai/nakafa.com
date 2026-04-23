import {
  ScrollArea,
  ScrollBar,
} from "@repo/design-system/components/ui/scroll-area";
import { cn } from "@repo/design-system/lib/utils";
import type { HTMLAttributes } from "react";
import {
  BlockMath as BlockMathReactKatex,
  InlineMath as InlineMathReactKatex,
  type MathComponentProps,
} from "react-katex";

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
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("my-4 space-y-4 content-auto-md last:mb-0", className)}
      {...props}
    />
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
        "overflow-hidden rounded-xl border bg-card text-card-foreground content-auto-sm",
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

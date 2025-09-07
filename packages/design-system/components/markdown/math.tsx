import {
  ScrollArea,
  ScrollBar,
} from "@repo/design-system/components/ui/scroll-area";
import type { HTMLAttributes } from "react";
import {
  BlockMath as BlockMathReactKatex,
  InlineMath as InlineMathReactKatex,
  type MathComponentProps,
} from "react-katex";
import { cn } from "../../lib/utils";

export function MathContainer({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("my-4 space-y-4 last:mb-0", className)} {...props} />
  );
}

export function BlockMath({
  className,
  ...props
}: MathComponentProps & { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm",
        className
      )}
    >
      <ScrollArea className="grid" type="hover">
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

export function InlineMath(props: MathComponentProps) {
  return (
    <InlineMathReactKatex
      errorColor="var(--color-muted-foreground)"
      {...props}
    />
  );
}

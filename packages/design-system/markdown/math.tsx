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

export function MathContainer(props: HTMLAttributes<HTMLDivElement>) {
  return <div className="my-4 space-y-4 last:mb-0" {...props} />;
}

export function BlockMath(props: MathComponentProps) {
  return (
    <ScrollArea
      className="mx-auto w-full max-w-[300px] rounded-xl border bg-card text-card-foreground shadow-sm sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
      type="hover"
    >
      <div className="px-4">
        <BlockMathReactKatex {...props} />
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

export function InlineMath(props: MathComponentProps) {
  return <InlineMathReactKatex {...props} />;
}

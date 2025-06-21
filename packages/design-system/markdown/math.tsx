import {
  ScrollArea,
  ScrollBar,
} from "@repo/design-system/components/ui/scroll-area";
import {
  BlockMath as BlockMathReactKatex,
  InlineMath as InlineMathReactKatex,
  type MathComponentProps,
} from "react-katex";

export function BlockMath(props: MathComponentProps) {
  return (
    <ScrollArea
      className="max-w-full rounded-xl border bg-card text-card-foreground shadow-sm"
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

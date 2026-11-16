import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Array as Arr } from "effect";

/**
 * A reading worked out over several lines of math, one state or step on
 * each, so no expression breaks across a line on a narrow card.
 */
export function MathLines({ lines }: { readonly lines: readonly string[] }) {
  return (
    <span className="flex flex-col gap-0.5">
      {Arr.map(lines, (line) => (
        <InlineMath key={line} math={line} />
      ))}
    </span>
  );
}

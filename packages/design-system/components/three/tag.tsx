import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import type { ComponentProps, ReactNode } from "react";

/**
 * The label of one mark of a graph: what it is in KaTeX, such as an
 * asymptote's equation or a vector's symbol, in the mark's own color, after
 * its name in words where the card is wide enough to hold both. A phone shows
 * the math alone, so labels never crowd a narrow graph. The label stands off
 * its anchor by `gap`, so it never covers the point, the arrowhead or the
 * curve it names.
 */
export function GraphTag({
  anchorX = "left",
  anchorY = "middle",
  color,
  gap = 0.1,
  math,
  name,
  position,
}: Pick<
  ComponentProps<typeof ThreeLabel>,
  "anchorX" | "anchorY" | "color" | "gap" | "position"
> & {
  readonly math: string;
  readonly name?: ReactNode;
}) {
  return (
    <ThreeLabel
      anchorX={anchorX}
      anchorY={anchorY}
      color={color}
      fontSize="compact"
      gap={gap}
      position={position}
    >
      <span className="flex items-baseline gap-1.5 font-medium">
        {name === undefined ? null : (
          <span className="max-sm:hidden">{name}</span>
        )}
        <InlineMath math={math} />
      </span>
    </ThreeLabel>
  );
}

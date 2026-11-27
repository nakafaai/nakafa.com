import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import type { ComponentProps, ReactNode } from "react";

/**
 * One reading or symbol beside a part of a benchtop rig, in the card's ink:
 * small enough to stay under the apparatus it names, and never smaller than a
 * phone can read. Its content is KaTeX, so a symbol and a unit read the same
 * in every language.
 */
export function Tag({
  anchorX,
  children,
  position,
}: {
  readonly anchorX?: ComponentProps<typeof ThreeLabel>["anchorX"];
  readonly children: ReactNode;
  readonly position: readonly [number, number, number];
}) {
  const ink = useLabelInk();

  return (
    <ThreeLabel
      anchorX={anchorX}
      color={ink}
      fontSize="compact"
      maximumFontSize={15}
      position={position}
    >
      <span>{children}</span>
    </ThreeLabel>
  );
}

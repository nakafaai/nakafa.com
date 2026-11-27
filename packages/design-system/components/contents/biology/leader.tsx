import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import type { ReactNode } from "react";

/** A point of the scene, in scene units. */
type Place = readonly [number, number, number];

/**
 * A label set clear of its subject with a fine leader line from the label to
 * the part it names, as a figure in a textbook is labelled. The label sits
 * on the side of its anchor away from the part, so the line leaves from the
 * edge of the text and never crosses it.
 *
 * @param anchorX - Which edge of the text sits on the anchor, across
 * @param anchorY - Which edge of the text sits on the anchor, up and down
 * @param at - Where the label is anchored, clear of the subject
 * @param to - The part the label names, where its leader ends
 */
export function Leader({
  anchorX = "center",
  anchorY = "middle",
  at,
  children,
  to,
}: {
  readonly anchorX?: "center" | "left" | "right";
  readonly anchorY?: "bottom" | "middle" | "top";
  readonly at: Place;
  readonly children: ReactNode;
  readonly to: Place;
}) {
  const ink = useLabelInk();

  return (
    <group>
      <ThreeLabel
        anchorX={anchorX}
        anchorY={anchorY}
        color={ink}
        fontSize="compact"
        gap={0.014}
        position={at}
      >
        {children}
      </ThreeLabel>
      <ArrowHelper
        color={ink}
        from={at}
        lineWidth={1.25}
        showArrow={false}
        to={to}
      />
    </group>
  );
}

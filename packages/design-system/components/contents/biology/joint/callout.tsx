import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { LineEquation } from "@repo/design-system/components/three/line";
import type { ReactNode } from "react";

/**
 * The name of one part of a joint, standing in open space and joined by a
 * thin leader to the part it names, in the ink of the card's theme.
 *
 * @param at - Where the name stands
 * @param target - The point of the part it names
 * @param side - Which edge of the name the leader leaves from
 */
export function Callout({
  at,
  children,
  side,
  target,
}: {
  readonly at: readonly [number, number, number];
  readonly children: ReactNode;
  readonly side: "bottom" | "left" | "right" | "top";
  readonly target: readonly [number, number, number];
}) {
  const ink = useLabelInk();
  const upright = side === "bottom" || side === "top";
  return (
    <group>
      <LineEquation
        color={ink}
        lineWidth={1}
        points={[
          { x: at[0], y: at[1], z: at[2] },
          { x: target[0], y: target[1], z: target[2] },
        ]}
        showPoints={false}
      />
      <ThreeLabel
        anchorX={upright ? "center" : side}
        anchorY={upright ? side : "middle"}
        color={ink}
        fontSize="compact"
        gap={0.035}
        position={at}
      >
        {children}
      </ThreeLabel>
    </group>
  );
}

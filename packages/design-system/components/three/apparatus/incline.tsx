import { distanceSheet } from "@repo/design-system/components/three/apparatus/distance";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { PrintFace } from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import type { Sheet } from "@repo/design-system/components/three/print/sheet";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import type { ReactNode } from "react";
import { useMemo } from "react";

/**
 * The sizes of the inclined plane: how long, how thick and how deep its
 * board is, how thick the base board under it is, and the radius of the arc
 * that marks its angle.
 */
export const INCLINE = {
  arc: 0.62,
  base: 0.05,
  deep: 0.5,
  long: 3.3,
  thick: 0.16,
} as const;

/** How far the base board runs out past each end of the plane's shadow. */
const MARGIN = 0.2;

/**
 * An inclined plane on the bench, its hinge on the origin and its board
 * rising toward +x: a deep pine board hinged in brass to an oak base board,
 * with a scale in metres printed up its side and an arc that marks its
 * angle. Whatever is placed on it is given as children, in the frame of the
 * board's top face: the origin at the hinge end, x up the slope and y away
 * from the board.
 *
 * @param angle - The plane's angle to the horizontal, in degrees
 * @param children - What stands on the plane, in the frame of its top face
 * @param ink - The colour of the arc that marks the angle
 * @param scale - The scale up its side: how far a block slides on it in metres, how long one metre is drawn, and how far up from the hinge zero stands
 */
export function Incline({
  angle,
  children,
  ink,
  scale,
}: {
  readonly angle: number;
  readonly children: ReactNode;
  readonly ink: string;
  readonly scale: {
    readonly distance: number;
    readonly metre: number;
    readonly start: number;
  };
}) {
  const format = usePrintNumber();
  const turn = (angle * Math.PI) / 180;
  const run = INCLINE.long * Math.cos(turn);
  const side = useMemo(
    () =>
      distanceSheet(
        {
          long: INCLINE.long,
          metre: scale.metre,
          start: scale.start,
          tall: INCLINE.thick,
        },
        scale.distance,
        INSTRUMENT_COLORS.graphite,
        format
      ),
    [format, scale.distance, scale.metre, scale.start]
  );
  const arc = useMemo(
    (): Sheet => ({
      height: INCLINE.arc * 2 + 0.1,
      marks: [
        {
          at: [0, 0],
          from: 0,
          ink,
          kind: "arc",
          radius: INCLINE.arc,
          to: turn,
          width: 0.012,
        },
      ],
      width: INCLINE.arc * 2 + 0.1,
    }),
    [ink, turn]
  );

  return (
    <group>
      <mesh castShadow position={[run / 2, INCLINE.base / 2, 0]} receiveShadow>
        <boxGeometry
          args={[run + MARGIN * 2, INCLINE.base, INCLINE.deep + 0.12]}
        />
        <Matter of="oak" />
      </mesh>
      <group position={[0, INCLINE.base, 0]}>
        <mesh
          castShadow
          position={[-0.02, 0.035, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.035, 0.035, INCLINE.deep + 0.05, 20]} />
          <Matter of="brass" />
        </mesh>
        <group position={[0, 0, INCLINE.deep / 2 + 0.03]}>
          <PrintFace sheet={arc} stock="ink" />
        </group>
        <group rotation={[0, 0, turn]}>
          <mesh
            castShadow
            position={[INCLINE.long / 2, INCLINE.thick / 2, 0]}
            receiveShadow
          >
            <boxGeometry args={[INCLINE.long, INCLINE.thick, INCLINE.deep]} />
            <Matter of="beech" />
          </mesh>
          <group
            position={[
              INCLINE.long / 2,
              INCLINE.thick / 2,
              INCLINE.deep / 2 + 0.001,
            ]}
          >
            <PrintFace sheet={side} stock="ink" />
          </group>
          <group position={[0, INCLINE.thick, 0]}>{children}</group>
        </group>
      </group>
    </group>
  );
}

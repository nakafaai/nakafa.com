import { RoundedBox } from "@react-three/drei";
import { MILLIMETRE } from "@repo/design-system/components/three/instrument/scale";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import type { ReactNode } from "react";

/** How thick the plate is, in millimetres. */
const THICK = 40;

/** How high the plate's lapped face stands over the bench, in scene units. */
export const PLATE_TOP = THICK * MILLIMETRE;

/**
 * A granite surface plate on the bench: the lapped black slab a workshop
 * lays its measuring instruments on, because it is flat to a few microns.
 * Its children lie on its face, which stands `PLATE_TOP` over the bench,
 * with the origin at the middle of the face.
 *
 * @param wide - How wide the plate is, in millimetres
 * @param deep - How deep the plate is, in millimetres
 */
export function Plate({
  children,
  deep,
  wide,
}: {
  readonly children: ReactNode;
  readonly deep: number;
  readonly wide: number;
}) {
  return (
    <group position={[0, PLATE_TOP, 0]}>
      <group scale={MILLIMETRE}>
        <RoundedBox
          args={[wide, THICK, deep]}
          castShadow
          position={[0, -THICK / 2, 0]}
          radius={2.4}
          receiveShadow
          smoothness={4}
        >
          <SurfaceMaterial
            bump={0.2}
            coat={0.35}
            color={INSTRUMENT_COLORS.granite}
            repeat={[wide / 60, deep / 60]}
            roughness={0.34}
            surface="stone"
          />
        </RoundedBox>
      </group>
      {children}
    </group>
  );
}

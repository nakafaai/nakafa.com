import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";

/** The desk's width, thickness and depth: wide enough to run out of every view. */
const DESK = { depth: 36, thick: 0.4, width: 60 } as const;

/**
 * The walnut desk an instrument rests on. It runs past the edges of the view
 * and stays out of the camera's framing, so the instrument fills the frame.
 *
 * @param top - The height of the desk's surface
 */
export function Desk({ top }: { readonly top: number }) {
  return (
    <CameraBounds exclude>
      <mesh position={[0, top - DESK.thick / 2, 0]} receiveShadow>
        <boxGeometry args={[DESK.width, DESK.thick, DESK.depth]} />
        <SurfaceMaterial
          color={MACHINE_COLORS.walnut}
          repeat={[30, 24]}
          roughness={0.55}
          surface="wood"
        />
      </mesh>
    </CameraBounds>
  );
}

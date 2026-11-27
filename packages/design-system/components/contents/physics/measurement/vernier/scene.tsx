import { Caliper } from "@repo/design-system/components/three/instrument/caliper";
import { ReadingCamera } from "@repo/design-system/components/three/instrument/camera";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { useMemo } from "react";
import { Vector2 } from "three";

/** How tall the brass cylinder stands on the bench, in millimetres. */
const TALL = 19;

/** How far below the beam the middle of a small cylinder sits between the jaws, in millimetres. */
const DEEP = 21;

/** The profile of a turned cylinder `radius` wide, chamfered at both ends, from its axis outward. */
function turned(radius: number) {
  const chamfer = Math.min(0.7, radius * 0.2);
  return [
    new Vector2(0, 0),
    new Vector2(radius - chamfer, 0),
    new Vector2(radius, chamfer),
    new Vector2(radius, TALL - chamfer),
    new Vector2(radius - chamfer, TALL),
    new Vector2(0, TALL),
  ];
}

/**
 * A vernier caliper closed on a turned brass cylinder `width` millimetres
 * across, on the bench. The camera stands over the vernier, and the beam
 * slides under it, so the reading stays in view at every width.
 *
 * @param width - The cylinder's diameter, in millimetres
 */
export function CaliperScene({ width }: { readonly width: number }) {
  const profile = useMemo(() => turned(width / 2), [width]);

  return (
    <group>
      <ReadingCamera
        narrow={[0.1, 0.46, 0.2]}
        target={[0.1, 0.04, -0.035]}
        wide={[0.1, 0.4, 0.17]}
      />
      <Caliper hold="slide" reading={width}>
        <mesh
          castShadow
          position={[width / 2, -Math.max(width / 2 + 1.5, DEEP), -1]}
          receiveShadow
          rotation={[Math.PI / 2, 0, 0]}
        >
          <latheGeometry args={[profile, 96]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.brass}
            metalness={1}
            repeat={[6, 1]}
            roughness={0.26}
            surface="brushed"
          />
        </mesh>
      </Caliper>
    </group>
  );
}

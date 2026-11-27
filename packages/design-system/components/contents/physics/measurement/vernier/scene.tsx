import { Caliper } from "@repo/design-system/components/three/instrument/caliper";
import { ReadingCamera } from "@repo/design-system/components/three/instrument/camera";
import {
  PLATE_TOP,
  Plate,
} from "@repo/design-system/components/three/instrument/plate";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
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
 * @param main - The whole millimetres the vernier zero has passed
 * @param line - The vernier line that meets a main mark
 */
export function CaliperScene({
  line,
  main,
  width,
}: {
  readonly line: number;
  readonly main: number;
  readonly width: number;
}) {
  const profile = useMemo(() => turned(width / 2), [width]);

  return (
    <group>
      <ReadingCamera
        narrow={[0.09, 0.7, 0.5]}
        surface={PLATE_TOP}
        target={[0.09, 0, 0.03]}
        wide={[0.1, 0.52, 0.38]}
      />
      <Plate deep={260} wide={520}>
        <Caliper
          hold="slide"
          pointed={{
            line: [line, PLOT_COLORS.fuchsia],
            main: [main, PLOT_COLORS.teal],
          }}
          reading={width}
        >
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
      </Plate>
    </group>
  );
}

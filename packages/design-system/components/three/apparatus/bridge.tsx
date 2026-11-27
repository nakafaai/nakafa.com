import { Borosilicate } from "@repo/design-system/components/three/apparatus/vessel";
import { Sweep } from "@repo/design-system/components/three/form/part";
import type { Path } from "@repo/design-system/components/three/form/path";
import {
  pointOn,
  trackOf,
} from "@repo/design-system/components/three/form/path";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { LABWARE_COLORS } from "@repo/design-system/lib/material/labware";
import { Array as Arr } from "effect";
import { useMemo } from "react";

/** The two ends of a bridge, as shares of the way along it. */
const ENDS = [0, 1] as const;

/**
 * A salt bridge: a glass tube bent along a `path`, filled with the pale
 * agar jelly that carries the salt, and stopped at each end with a plug of
 * cotton wool that stands just inside the glass.
 *
 * @example
 * <SaltBridge path={invertedU} radius={0.0096} />
 *
 * @param path - The line of the tube, from one end to the other
 * @param radius - The tube's outer radius, in the units of the path
 */
export function SaltBridge({
  path,
  radius,
}: {
  readonly path: Path;
  readonly radius: number;
}) {
  const track = useMemo(() => trackOf(path), [path]);
  return (
    <group>
      <mesh renderOrder={1}>
        <Sweep path={path} radius={radius * 0.78} />
        <meshPhysicalMaterial
          color={LABWARE_COLORS.agar}
          depthWrite={false}
          opacity={0.55}
          roughness={0.5}
          transparent
        />
      </mesh>
      <mesh castShadow renderOrder={2}>
        <Sweep ends="open" path={path} radius={radius} />
        <Borosilicate />
      </mesh>
      {Arr.map(ENDS, (end) => {
        const [x, y, z] = pointOn(track, end);
        return (
          <mesh
            key={end}
            position={[x, y + radius * 0.6, z]}
            scale={[1, 1.5, 1]}
          >
            <sphereGeometry args={[radius * 0.8, 24, 16]} />
            <SurfaceMaterial
              bump={1}
              color={LABWARE_COLORS.cotton}
              repeat={[2, 2]}
              roughness={1}
              surface="cloth"
            />
          </mesh>
        );
      })}
    </group>
  );
}

import { useFrame } from "@react-three/fiber";
import { ROAD } from "@repo/design-system/components/contents/physics/kinematics/road";
import { ball } from "@repo/design-system/components/contents/physics/kinematics/round";
import {
  pennantSheet,
  rippleAt,
} from "@repo/design-system/components/contents/physics/kinematics/secant/pennant";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { Turn } from "@repo/design-system/components/three/form/part";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { getColor } from "@repo/design-system/lib/color";
import { GATE_COLORS } from "@repo/design-system/lib/material/gate";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from "three";

/** The height of the pole and the size of its pennant, in metres. */
const POLE = 2.6;

/** The weighted base, the staff and the ball on its top, as outlines turned about the pole's axis. */
const BASE = [
  [0, 0],
  [0.24, 0],
  [0.2, 0.08],
  [0, 0.08],
] as const;
const STAFF = [
  [0, 0],
  [0.02, 0],
  [0.016, POLE],
  [0, POLE],
] as const;
const FINIAL = ball(0.035);
const FLY = 0.95;
const HOIST = 0.55;

/**
 * A marker flag in the verge, `at` metres along the road: a white pole on a
 * weighted base with a ball finial and a pennant in the colour its moment
 * carries on the graph, which waves in the wind. Its label names the
 * moment, so the learner reads on the road where the car was then.
 *
 * @param at - Where the flag stands along the road, in metres
 * @param children - The name of the moment the flag marks
 * @param color - The pennant's colour, which the lab ties to its graph
 * @param side - Which verge the flag stands in: -1 the far one, 1 the near one
 */
export function MarkerFlag({
  at,
  children,
  color,
  side,
}: {
  readonly at: number;
  readonly children: ReactNode;
  readonly color: string;
  readonly side: 1 | -1;
}) {
  const wind = useRef(at);
  const cloth = useMemo(() => {
    const sheet = pennantSheet(FLY, HOIST);
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(sheet.positions, 3)
    );
    geometry.setIndex(sheet.indices);
    geometry.computeVertexNormals();
    return { alongs: sheet.alongs, geometry };
  }, []);
  useEffect(() => () => cloth.geometry.dispose(), [cloth]);

  useFrame((_, delta) => {
    wind.current += simulationStep(delta);
    const places = cloth.geometry.getAttribute("position");
    for (let index = 0; index < cloth.alongs.length; index += 1) {
      places.setZ(index, rippleAt(cloth.alongs[index] ?? 0, wind.current, FLY));
    }
    places.needsUpdate = true;
    cloth.geometry.computeVertexNormals();
  });

  return (
    <group position={[at, 0, side * (ROAD.halfWidth + 0.4)]}>
      <mesh castShadow receiveShadow>
        <Turn profile={BASE} />
        <SurfaceMaterial
          color={GATE_COLORS.housing}
          repeat={[2, 1]}
          roughness={0.7}
          surface="rubber"
        />
      </mesh>
      <mesh castShadow position={[0, 0.08, 0]}>
        <Turn profile={STAFF} />
        <SurfaceMaterial
          coat={0.4}
          color={getColor("SLATE", 50)}
          repeat={[1, 4]}
          roughness={0.4}
          surface="paint"
        />
      </mesh>
      <mesh castShadow position={[0, POLE + 0.065, 0]}>
        <Turn profile={FINIAL} />
        <SurfaceMaterial
          color={GATE_COLORS.steel}
          metalness={0.9}
          repeat={[1, 1]}
          roughness={0.25}
          surface="brushed"
        />
      </mesh>
      <mesh
        castShadow
        geometry={cloth.geometry}
        position={[0.018, POLE + 0.04, 0]}
      >
        <SurfaceMaterial
          color={color}
          repeat={[2, 2]}
          roughness={0.85}
          side={DoubleSide}
          surface="cloth"
        />
      </mesh>
      <ThreeLabel
        color={color}
        fontSize="compact"
        outlineColor={getColor("SLATE", 50)}
        outlineWidth={0.05}
        position={[0, POLE + 0.55, 0]}
      >
        {children}
      </ThreeLabel>
    </group>
  );
}

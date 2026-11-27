import {
  STOPWATCH_HAND_CENTER,
  STOPWATCH_HAND_LENGTH,
  STOPWATCH_SECONDS_PER_ROTATION,
  TIME_SCENE_SCALE,
} from "@repo/design-system/components/contents/physics/measurement/tools/data";
import { Desk } from "@repo/design-system/components/contents/physics/measurement/tools/desk";
import type { MeasurementSceneProps } from "@repo/design-system/components/contents/physics/measurement/tools/scene";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import type { Placement } from "@repo/design-system/components/three/repeat";
import { Repeat } from "@repo/design-system/components/three/repeat";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { Array as Arr } from "effect";

/** The radius of the dial, in scene units. */
const DIAL = 1.08;

/** The radius of the sphere the domed crystal is cut from, so its rim meets the bezel. */
const CRYSTAL = (DIAL + 0.1) / Math.sin(Math.PI / 7);

/** The dial's ticks: one a second, and a longer, bolder one every five seconds. */
function ticks(every: number, length: number): readonly Placement[] {
  return Arr.map(
    Arr.filter(
      Arr.makeBy(60, (second) => second),
      (second) => (every === 5 ? second % 5 === 0 : second % 5 !== 0)
    ),
    (second) => {
      const angle = (second / 60) * Math.PI * 2;
      const reach = DIAL - 0.05 - length / 2;
      return {
        position: [Math.sin(angle) * reach, Math.cos(angle) * reach, 0.172],
        rotation: [0, 0, -angle],
      };
    }
  );
}

/** The five-second ticks and the second ticks between them. */
const MAJOR_TICKS = ticks(5, 0.16);
const MINOR_TICKS = ticks(1, 0.08);

/**
 * A mechanical stopwatch with its hand at the elapsed seconds: a chrome case
 * and bezel, a white enamel dial with a tick every second and a bolder one
 * every five, the crown, bow and side pusher on top, a red sweep hand with
 * its counterweight and centre cap, and a domed crystal over it all.
 */
/** How far the case's back lies behind its middle, which rests on the desk. */
const CASE_BACK = 0.15;

export function TimeScene({
  colors,
  measurement,
  reading,
}: MeasurementSceneProps) {
  const handAngle =
    (measurement / STOPWATCH_SECONDS_PER_ROTATION) * Math.PI * 2;

  return (
    <group
      position={[0, CASE_BACK * TIME_SCENE_SCALE, 0]}
      rotation={[-Math.PI / 2, 0, 0.22]}
      scale={TIME_SCENE_SCALE}
    >
      {/* The watch lies on its back, so the desk is behind it along its own z. */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <Desk top={-CASE_BACK} />
      </group>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.3, 1.3, 0.3, 96]} />
        <SurfaceMaterial
          color={CAR_COLORS.chrome}
          metalness={1}
          roughness={0.3}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow position={[0, 0, 0.15]}>
        <torusGeometry args={[1.2, 0.09, 20, 96]} />
        <SurfaceMaterial
          color={CAR_COLORS.chrome}
          metalness={1}
          roughness={0.18}
          surface="brushed"
        />
      </mesh>
      <mesh position={[0, 0, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[DIAL + 0.04, DIAL + 0.04, 0.02, 96]} />
        <SurfaceMaterial color={MACHINE_COLORS.dialWhite} surface="plastic" />
      </mesh>
      <Repeat placements={MAJOR_TICKS} shadows={false}>
        <boxGeometry args={[0.035, 0.16, 0.004]} />
        <meshStandardMaterial color={CAR_COLORS.tyre} roughness={0.5} />
      </Repeat>
      <Repeat placements={MINOR_TICKS} shadows={false}>
        <boxGeometry args={[0.014, 0.08, 0.004]} />
        <meshStandardMaterial color={CAR_COLORS.tyre} roughness={0.5} />
      </Repeat>

      <group position={[0, 1.3, 0]}>
        <mesh castShadow position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.18, 20]} />
          <SurfaceMaterial
            color={CAR_COLORS.chrome}
            metalness={1}
            roughness={0.3}
            surface="brushed"
          />
        </mesh>
        <mesh castShadow position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.14, 28]} />
          <SurfaceMaterial
            color={CAR_COLORS.chrome}
            metalness={1}
            roughness={0.45}
            surface="brushed"
          />
        </mesh>
        <mesh castShadow position={[0, 0.48, 0]}>
          <torusGeometry args={[0.2, 0.035, 12, 40]} />
          <SurfaceMaterial
            color={CAR_COLORS.chrome}
            metalness={1}
            roughness={0.2}
            surface="brushed"
          />
        </mesh>
      </group>
      <mesh
        castShadow
        position={[0.82, 1.02, 0]}
        rotation={[0, 0, -Math.PI / 4]}
      >
        <cylinderGeometry args={[0.07, 0.07, 0.2, 20]} />
        <SurfaceMaterial
          color={CAR_COLORS.chrome}
          metalness={1}
          roughness={0.3}
          surface="brushed"
        />
      </mesh>

      <group rotation={[0, 0, -handAngle]}>
        <mesh position={[0, STOPWATCH_HAND_CENTER, 0.19]}>
          <boxGeometry args={[0.03, STOPWATCH_HAND_LENGTH, 0.012]} />
          <meshStandardMaterial
            color={MACHINE_COLORS.signalRed}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0, -0.18, 0.19]}>
          <boxGeometry args={[0.06, 0.26, 0.012]} />
          <meshStandardMaterial
            color={MACHINE_COLORS.signalRed}
            roughness={0.4}
          />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.03, 24]} />
        <SurfaceMaterial
          color={CAR_COLORS.chrome}
          metalness={1}
          roughness={0.25}
          surface="brushed"
        />
      </mesh>
      <mesh
        position={[0, 0, 0.17 - CRYSTAL * Math.cos(Math.PI / 7)]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <sphereGeometry
          args={[CRYSTAL, 64, 12, 0, Math.PI * 2, 0, Math.PI / 7]}
        />
        <meshPhysicalMaterial
          clearcoat={1}
          color={BENCH_COLORS.glass}
          depthWrite={false}
          opacity={0.14}
          roughness={0.02}
          transparent
        />
      </mesh>
      <ThreeLabel
        anchorY="top"
        color={colors.text}
        fontSize="display"
        position={[0, -1.62, 0]}
      >
        {reading}
      </ThreeLabel>
    </group>
  );
}

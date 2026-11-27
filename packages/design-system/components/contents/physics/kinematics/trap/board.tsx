import { RoundedBox } from "@react-three/drei";
import { ROAD } from "@repo/design-system/components/contents/physics/kinematics/road";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { GATE_COLORS } from "@repo/design-system/lib/material/gate";
import type { ReactNode } from "react";

/** The height of the board's middle over the pavement, and its size, in metres. */
const HEIGHT = 2.5;
const SIZE = [1.9, 1.05] as const;

/**
 * The speed board on the pavement past a trap, the kind that shows drivers
 * their speed: a dark display in a steel frame on a tubular post, turned to
 * face the road and the learner. It shows what the trap has just timed in
 * amber, or stays dark until a car has left the trap.
 *
 * @param at - Where the board stands along the road, in metres
 * @param children - What the display shows, one reading under the other
 * @param lit - Whether the trap has a reading to show
 */
export function SpeedBoard({
  at,
  children,
  lit,
}: {
  readonly at: number;
  readonly children: ReactNode;
  readonly lit: boolean;
}) {
  return (
    <group
      position={[at, ROAD.kerb, -(ROAD.halfWidth + 1.25)]}
      rotation={[0, 0.5, 0]}
    >
      <mesh castShadow position={[0, (HEIGHT - SIZE[1] / 2) / 2, -0.07]}>
        <cylinderGeometry args={[0.045, 0.05, HEIGHT - SIZE[1] / 2, 20]} />
        <SurfaceMaterial
          color={GATE_COLORS.steel}
          metalness={0.85}
          repeat={[1, 4]}
          roughness={0.42}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow position={[0, 0.03, -0.07]} receiveShadow>
        <cylinderGeometry args={[0.16, 0.18, 0.06, 28]} />
        <SurfaceMaterial
          color={GATE_COLORS.footing}
          repeat={[1, 1]}
          surface="concrete"
        />
      </mesh>
      <RoundedBox
        args={[SIZE[0] + 0.12, SIZE[1] + 0.12, 0.1]}
        castShadow
        position={[0, HEIGHT, 0]}
        radius={0.03}
        smoothness={4}
      >
        <SurfaceMaterial
          color={GATE_COLORS.boardFrame}
          metalness={0.6}
          repeat={[2, 1]}
          roughness={0.5}
          surface="brushed"
        />
      </RoundedBox>
      <mesh position={[0, HEIGHT, 0.052]}>
        <planeGeometry args={[SIZE[0], SIZE[1]]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.25}
          color={GATE_COLORS.board}
          roughness={0.5}
        />
      </mesh>
      <mesh castShadow position={[0, HEIGHT + SIZE[1] / 2 + 0.09, 0.09]}>
        <boxGeometry args={[SIZE[0] + 0.16, 0.025, 0.3]} />
        <SurfaceMaterial
          color={GATE_COLORS.boardFrame}
          metalness={0.6}
          repeat={[2, 1]}
          roughness={0.5}
          surface="brushed"
        />
      </mesh>
      <ThreeLabel
        color={GATE_COLORS.boardText}
        fontSize="compact"
        position={[0, HEIGHT, 0.06]}
        visible={lit}
      >
        {children}
      </ThreeLabel>
    </group>
  );
}

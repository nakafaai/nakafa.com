import { RoundedBox } from "@react-three/drei";
import { ROAD } from "@repo/design-system/components/contents/physics/kinematics/road";
import { Turn } from "@repo/design-system/components/three/form/part";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { GATE_COLORS } from "@repo/design-system/lib/material/gate";
import type { ReactNode } from "react";

/** The height of the board's middle over the pavement, and its size, in metres. */
const HEIGHT = 2.5;
const SIZE = [1.9, 1.05] as const;

/** The post the board stands on and its footing, as outlines turned about the post's axis. */
const POST = [
  [0, 0],
  [0.05, 0],
  [0.045, HEIGHT - SIZE[1] / 2],
  [0, HEIGHT - SIZE[1] / 2],
] as const;
const FOOTING = [
  [0, 0],
  [0.18, 0],
  [0.16, 0.06],
  [0, 0.06],
] as const;

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
    <group position={[at, 0, -(ROAD.halfWidth + 1.25)]} rotation={[0, 0.5, 0]}>
      <mesh castShadow position={[0, 0, -0.07]}>
        <Turn profile={POST} />
        <SurfaceMaterial
          color={GATE_COLORS.steel}
          metalness={0.85}
          repeat={[1, 4]}
          roughness={0.42}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow position={[0, 0, -0.07]} receiveShadow>
        <Turn profile={FOOTING} />
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
      <RoundedBox
        args={[SIZE[0], SIZE[1], 0.006]}
        position={[0, HEIGHT, 0.05]}
        radius={0.002}
        smoothness={2}
      >
        <SurfaceMaterial
          coat={1}
          color={GATE_COLORS.board}
          repeat={[2, 1]}
          roughness={0.5}
          surface="plastic"
        />
      </RoundedBox>
      <RoundedBox
        args={[SIZE[0] + 0.16, 0.025, 0.3]}
        castShadow
        position={[0, HEIGHT + SIZE[1] / 2 + 0.09, 0.09]}
        radius={0.008}
        smoothness={3}
      >
        <SurfaceMaterial
          color={GATE_COLORS.boardFrame}
          metalness={0.6}
          repeat={[2, 1]}
          roughness={0.5}
          surface="brushed"
        />
      </RoundedBox>
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

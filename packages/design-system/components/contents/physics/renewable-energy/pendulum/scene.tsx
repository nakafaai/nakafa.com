import { useFrame } from "@react-three/fiber";
import { advanceRun } from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  type Drag,
  DURATION,
  LENGTH,
  STEP,
  type Swing,
  swingAt,
} from "@repo/design-system/components/contents/physics/renewable-energy/pendulum/swing";
import { Pipe } from "@repo/design-system/components/contents/physics/renewable-energy/world/parts";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

/** How long the last moment rests before the bob is let go again, in seconds. */
const HOLD_SECONDS = 1.5;

/** The pivot's height above the floor, in metres. */
const PIVOT = LENGTH + 0.35;

/**
 * A brass bob on a 2 m string hung from a steel frame, swinging in real time
 * from the run the card computed; the card's facts carry its energy stores.
 */
export function PendulumScene({
  drag,
  run,
}: {
  readonly drag: Drag;
  readonly run: readonly Swing[];
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const time = useRef(0);
  const shown = useRef<Drag | undefined>(undefined);
  const arm = useRef<Group>(null);

  useFrame((_, delta) => {
    if (shown.current !== drag) {
      shown.current = drag;
      time.current = 0;
    }
    if (playing) {
      time.current = advanceRun(time.current, delta, {
        duration: DURATION,
        hold: HOLD_SECONDS,
        rate: 1,
      });
    }
    const state = swingAt(run, Math.min(time.current, DURATION - STEP));
    arm.current?.rotation.set(0, 0, state.angle);
  });

  return (
    <group>
      {Arr.map([-0.45, 0.45] as const, (z) => (
        <Pipe from={[-0.6, 0, z]} key={z} radius={0.025} to={[0, PIVOT, z]}>
          <MetalMaterial color={MATERIAL.galvanizedSteel} roughness={0.45} />
        </Pipe>
      ))}
      {Arr.map([-0.45, 0.45] as const, (z) => (
        <Pipe from={[0.6, 0, z]} key={z} radius={0.025} to={[0, PIVOT, z]}>
          <MetalMaterial color={MATERIAL.galvanizedSteel} roughness={0.45} />
        </Pipe>
      ))}
      <Pipe from={[0, PIVOT, -0.5]} radius={0.03} to={[0, PIVOT, 0.5]}>
        <MetalMaterial color={MATERIAL.castIron} roughness={0.4} />
      </Pipe>
      <group position={[0, PIVOT, 0]} ref={arm}>
        <mesh position={[0, -LENGTH / 2, 0]}>
          <cylinderGeometry args={[0.004, 0.004, LENGTH, 8]} />
          <meshStandardMaterial color={getColor("ZINC", 100)} />
        </mesh>
        <mesh castShadow position={[0, -LENGTH, 0]}>
          <sphereGeometry args={[0.09, 40, 24]} />
          <MetalMaterial color={MATERIAL.brass} roughness={0.22} />
        </mesh>
      </group>
    </group>
  );
}

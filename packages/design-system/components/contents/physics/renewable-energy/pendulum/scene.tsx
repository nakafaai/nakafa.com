import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { advanceRun } from "@repo/design-system/components/contents/physics/canvas/clock";
import type {
  Drag,
  Swing,
} from "@repo/design-system/components/contents/physics/renewable-energy/pendulum/swing";
import {
  DURATION,
  LENGTH,
  STEP,
  swingAt,
} from "@repo/design-system/components/contents/physics/renewable-energy/pendulum/swing";
import { Pipe } from "@repo/design-system/components/contents/physics/renewable-energy/world/parts";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

/** How long the last moment rests before the bob is let go again, in seconds. */
const HOLD_SECONDS = 1.5;

/** Where each of the frame's four legs stands: its foot along x and its side along z. */
const LEGS = [
  [-0.6, -0.45],
  [-0.6, 0.45],
  [0.6, -0.45],
  [0.6, 0.45],
] as const;

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
      {Arr.map(LEGS, ([foot, z]) => (
        <group key={`${foot}-${z}`}>
          <Pipe from={[foot, 0.03, z]} radius={0.025} to={[0, PIVOT, z]}>
            <SurfaceMaterial
              color={ENERGY_COLORS.galvanizedSteel}
              metalness={1}
              roughness={0.6}
              surface="brushed"
            />
          </Pipe>
          <mesh castShadow position={[foot, 0.02, z]}>
            <cylinderGeometry args={[0.045, 0.05, 0.04, 20]} />
            <SurfaceMaterial color={CAR_COLORS.tyre} surface="rubber" />
          </mesh>
        </group>
      ))}
      {Arr.map([-0.45, 0.45] as const, (z) => (
        <Pipe from={[-0.45, 0.5, z]} key={z} radius={0.018} to={[0.45, 0.5, z]}>
          <SurfaceMaterial
            color={ENERGY_COLORS.galvanizedSteel}
            metalness={1}
            roughness={0.6}
            surface="brushed"
          />
        </Pipe>
      ))}
      <Pipe from={[0, PIVOT, -0.5]} radius={0.03} to={[0, PIVOT, 0.5]}>
        <SurfaceMaterial
          color={CAR_COLORS.castIron}
          metalness={1}
          roughness={0.5}
          surface="brushed"
        />
      </Pipe>
      <RoundedBox
        args={[0.1, 0.1, 0.12]}
        castShadow
        position={[0, PIVOT, 0]}
        radius={0.015}
        smoothness={2}
      >
        <SurfaceMaterial color={MACHINE_COLORS.standBlue} surface="paint" />
      </RoundedBox>
      <group position={[0, PIVOT, 0]} ref={arm}>
        <mesh position={[0, -LENGTH / 2, 0]}>
          <cylinderGeometry args={[0.0025, 0.0025, LENGTH, 8]} />
          <SurfaceMaterial
            color={CAR_COLORS.chrome}
            metalness={1}
            roughness={0.4}
            surface="brushed"
          />
        </mesh>
        <mesh position={[0, -LENGTH + 0.1, 0]}>
          <torusGeometry args={[0.014, 0.004, 8, 20]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.brass}
            metalness={1}
            roughness={0.35}
            surface="brushed"
          />
        </mesh>
        <mesh position={[0, -LENGTH + 0.075, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.03, 10]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.brass}
            metalness={1}
            roughness={0.35}
            surface="brushed"
          />
        </mesh>
        <mesh castShadow position={[0, -LENGTH, 0]}>
          <sphereGeometry args={[0.09, 48, 32]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.brass}
            metalness={1}
            roughness={0.28}
            surface="brushed"
          />
        </mesh>
      </group>
    </group>
  );
}

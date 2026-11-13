import { useFrame } from "@react-three/fiber";
import { advanceRun } from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  crateHeight,
  LIFT_HEIGHT,
  liftTime,
  type Motor,
} from "@repo/design-system/components/contents/physics/renewable-energy/hoist/lift";
import { Pipe } from "@repo/design-system/components/contents/physics/renewable-energy/world/parts";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group, Mesh } from "three";

/** How long the crate rests on the platform before the run starts again, in seconds. */
const HOLD_SECONDS = 1.4;

/** The crate's edge, in metres. */
const CRATE = 0.6;

/** Where the crate hangs, in metres from the tower's middle. */
const CRATE_X = 1.05;

/** How high the winch drum sits, in metres. */
const DRUM_Y = LIFT_HEIGHT + 1.2;

/** The scaffold tower's four legs, in metres from its middle. */
const LEGS = [
  [-0.4, -0.4],
  [0.4, -0.4],
  [-0.4, 0.4],
  [0.4, 0.4],
] as const;

/** The scaffold tower: galvanised legs, a rung at every metre, a ruler of metre marks. */
function Tower() {
  return (
    <group>
      {Arr.map(LEGS, ([x, z]) => (
        <Pipe
          from={[x, 0, z]}
          key={`${x}${z}`}
          radius={0.03}
          to={[x, DRUM_Y + 0.1, z]}
        >
          <MetalMaterial color={MATERIAL.galvanizedSteel} roughness={0.5} />
        </Pipe>
      ))}
      {Arr.map(Arr.range(1, LIFT_HEIGHT + 1), (metre) => (
        <group key={metre}>
          <Pipe from={[-0.4, metre, 0.4]} radius={0.018} to={[0.4, metre, 0.4]}>
            <MetalMaterial color={MATERIAL.galvanizedSteel} roughness={0.5} />
          </Pipe>
          <Pipe
            from={[-0.4, metre - 1, 0.4]}
            radius={0.014}
            to={[0.4, metre, 0.4]}
          >
            <MetalMaterial color={MATERIAL.galvanizedSteel} roughness={0.5} />
          </Pipe>
        </group>
      ))}
      {Arr.map(Arr.range(0, LIFT_HEIGHT), (metre) => (
        <mesh key={metre} position={[-0.62, metre, 0.4]}>
          <boxGeometry args={[0.3, 0.025, 0.025]} />
          <meshStandardMaterial color={getColor("ZINC", 900)} />
        </mesh>
      ))}
      <mesh
        castShadow
        position={[CRATE_X + 0.95, LIFT_HEIGHT - 0.05, 0]}
        receiveShadow
      >
        <boxGeometry args={[1.2, 0.1, 1.1]} />
        <meshStandardMaterial color={MATERIAL.concrete} roughness={0.85} />
      </mesh>
    </group>
  );
}

/**
 * The winch, its rope and the crate. The crate rises at the steady speed the
 * motor's power allows and rests on the platform; the drum turns as fast as
 * it winds the rope.
 */
export function HoistScene({ motor }: { readonly motor: Motor }) {
  const playing = useVisualScene((card) => card.playing, false);
  const run = useRef(0);
  const shown = useRef<Motor | undefined>(undefined);
  const crate = useRef<Group>(null);
  const rope = useRef<Mesh>(null);
  const drum = useRef<Group>(null);

  useFrame((_, delta) => {
    const duration = liftTime(motor);
    if (shown.current !== motor) {
      shown.current = motor;
      run.current = 0;
    }
    if (playing) {
      run.current = advanceRun(run.current, delta, {
        duration,
        hold: HOLD_SECONDS,
        rate: 1,
      });
    }
    const height = crateHeight(motor, Math.min(run.current, duration));
    crate.current?.position.set(CRATE_X, height + CRATE / 2, 0);
    const length = DRUM_Y - (height + CRATE);
    rope.current?.position.set(CRATE_X, height + CRATE + length / 2, 0);
    rope.current?.scale.set(1, Math.max(length, 0.01), 1);
    drum.current?.rotation.set(0, 0, -height / 0.12);
  });

  return (
    <group>
      <Tower />
      <group position={[CRATE_X - 0.35, DRUM_Y, 0]}>
        <mesh castShadow position={[-0.35, 0, 0]}>
          <boxGeometry args={[0.45, 0.32, 0.32]} />
          <meshStandardMaterial color={MATERIAL.buoyPaint} roughness={0.5} />
        </mesh>
        <group ref={drum} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.12, 0.12, 0.3, 24]} />
            <MetalMaterial color={MATERIAL.castIron} />
          </mesh>
        </group>
      </group>
      <mesh ref={rope}>
        <cylinderGeometry args={[0.012, 0.012, 1, 8]} />
        <meshStandardMaterial color={MATERIAL.tyre} roughness={0.9} />
      </mesh>
      <group ref={crate}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[CRATE, CRATE, CRATE]} />
          <meshStandardMaterial color={MATERIAL.crateWood} roughness={0.75} />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh key={side} position={[0, 0, (side * CRATE) / 2]}>
            <boxGeometry args={[CRATE * 1.02, CRATE * 0.12, 0.02]} />
            <meshStandardMaterial color={MATERIAL.bark} roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

import { useFrame } from "@react-three/fiber";
import {
  type Block,
  GRAVITY,
  rampForces,
} from "@repo/design-system/components/contents/physics/vector/ramp/incline";
import { FixedArrow } from "@repo/design-system/components/contents/physics/vector/solid/arrow";
import { Rod } from "@repo/design-system/components/contents/physics/vector/solid/rod";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import type { CoordinateTuple } from "@repo/design-system/components/three/frame";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { useRef } from "react";
import type { Group } from "three";

/** The length of the plank, in metres. */
const PLANK = 0.8;

/** The thickness of the plank, in metres. */
const THICK = 0.02;

/** Where the block starts, in metres up the plank from the hinge. */
const START = 0.55;

/** The size of the block: along the slope, up from it, and across, in metres. */
const BLOCK = [0.1, 0.06, 0.08] as const;

/** The hinge at the foot of the plank. */
const HINGE = [-0.4, 0, 0] as const;

/** Metres of arrow per newton. */
const ARROW_SCALE = 0.016;

/** How long the block rests at the foot before it starts again, in seconds. */
const REST = 1.2;

/** A point a distance up the plank and a height off its top face, at a ramp angle. */
function onPlank(angle: number, along: number, off: number) {
  const turn = (angle * Math.PI) / 180;
  return [
    HINGE[0] + Math.cos(turn) * along - Math.sin(turn) * (THICK + off),
    HINGE[1] + Math.sin(turn) * along + Math.cos(turn) * (THICK + off),
    0,
  ] satisfies CoordinateTuple;
}

/** The bench slab, the hinged pine plank, and the stand that props up its far end. */
function Ramp({ angle }: { readonly angle: number }) {
  const turn = (angle * Math.PI) / 180;
  const middle = onPlank(angle, PLANK / 2, -THICK / 2);
  const top = onPlank(angle, PLANK - 0.04, -THICK);
  return (
    <group>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.04, 0.6]} />
        <meshStandardMaterial color={MATERIAL.epoxy} roughness={0.55} />
      </mesh>
      <mesh castShadow position={middle} receiveShadow rotation={[0, 0, turn]}>
        <boxGeometry args={[PLANK, THICK, 0.2]} />
        <meshStandardMaterial color={MATERIAL.pine} roughness={0.75} />
      </mesh>
      <mesh position={[HINGE[0], 0.006, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.22, 16]} />
        <meshStandardMaterial
          color={MATERIAL.chrome}
          metalness={1}
          roughness={0.25}
        />
      </mesh>
      {top[1] > 0.01 ? (
        <group>
          <Rod
            color={MATERIAL.chrome}
            from={[top[0], 0, 0.11]}
            metalness={1}
            radius={0.007}
            roughness={0.25}
            to={[top[0], top[1], 0.11]}
          />
          <Rod
            color={MATERIAL.castIron}
            from={[top[0], top[1], 0.11]}
            metalness={0.6}
            radius={0.009}
            roughness={0.4}
            to={[top[0], top[1], -0.04]}
          />
          <mesh castShadow position={[top[0], 0.008, 0.11]}>
            <boxGeometry args={[0.16, 0.016, 0.1]} />
            <meshStandardMaterial
              color={MATERIAL.castIron}
              metalness={0.6}
              roughness={0.45}
            />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

/** One force arrow from the block's centre with its symbol at the tip. */
function Force({
  color,
  math,
  vector,
}: {
  readonly color: string;
  readonly math: string;
  readonly vector: CoordinateTuple;
}) {
  return (
    <group>
      <FixedArrow
        color={color}
        from={[0, 0, 0.05]}
        head={0.03}
        thickness={0.0045}
        vector={vector}
      />
      <ThreeLabel
        color={color}
        fontSize="reading"
        position={[vector[0] * 1.18, vector[1] * 1.18 - 0.01, 0.05]}
      >
        <InlineMath math={math} />
      </ThreeLabel>
    </group>
  );
}

/**
 * The block on the ramp with its weight (violet), the weight's parts down
 * the slope (teal) and into it (amber), and the ramp's normal force
 * (slate). When the angle beats friction, the block slides down and starts
 * again.
 */
export function RampScene({
  angle,
  block,
}: {
  readonly angle: number;
  readonly block: Block;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const forces = rampForces(block, angle);
  const turn = (angle * Math.PI) / 180;
  const holder = useRef<Group>(null);
  const motion = useRef({ along: START, rest: 0, speed: 0 });
  const down = [-Math.cos(turn), -Math.sin(turn), 0] as const;
  const inward = [Math.sin(turn), -Math.cos(turn), 0] as const;
  const scale = (size: number, unit: readonly [number, number, number]) =>
    [
      unit[0] * size * ARROW_SCALE,
      unit[1] * size * ARROW_SCALE,
      0,
    ] satisfies CoordinateTuple;

  useFrame((_, delta) => {
    const state = motion.current;
    const step = Math.min(delta, 0.1);
    if (!forces.slips) {
      state.along = START;
      state.speed = 0;
    } else if (playing && state.along > BLOCK[0] / 2) {
      const friction = 0.8 * block.friction;
      state.speed +=
        GRAVITY * (Math.sin(turn) - friction * Math.cos(turn)) * step;
      state.along = Math.max(BLOCK[0] / 2, state.along - state.speed * step);
    } else if (playing) {
      state.rest += step;
      if (state.rest > REST) {
        state.along = START;
        state.speed = 0;
        state.rest = 0;
      }
    }
    const [x, y, z] = onPlank(angle, state.along, BLOCK[1] / 2);
    holder.current?.position.set(x, y, z);
  });

  return (
    <group>
      <SimulationTicker running={playing && forces.slips} />
      <Ramp angle={angle} />
      <group position={onPlank(angle, START, BLOCK[1] / 2)} ref={holder}>
        <mesh castShadow receiveShadow rotation={[0, 0, turn]}>
          <boxGeometry args={BLOCK} />
          <meshStandardMaterial color={MATERIAL.oak} roughness={0.7} />
        </mesh>
        <Force
          color={PLOT_COLORS.violet}
          math="\vec W"
          vector={[0, -forces.weight * ARROW_SCALE, 0]}
        />
        <Force
          color={PLOT_COLORS.teal}
          math="W\sin\theta"
          vector={scale(forces.along, down)}
        />
        <Force
          color={PLOT_COLORS.amber}
          math="W\cos\theta"
          vector={scale(forces.into, inward)}
        />
        <Force
          color={PLOT_COLORS.slate}
          math="\vec N"
          vector={scale(forces.normal, [-inward[0], -inward[1], 0])}
        />
      </group>
    </group>
  );
}

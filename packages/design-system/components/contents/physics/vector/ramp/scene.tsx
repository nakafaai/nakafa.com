import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Block } from "@repo/design-system/components/contents/physics/vector/ramp/incline";
import {
  GRAVITY,
  rampForces,
} from "@repo/design-system/components/contents/physics/vector/ramp/incline";
import { FixedArrow } from "@repo/design-system/components/contents/physics/vector/solid/arrow";
import { Bench } from "@repo/design-system/components/contents/physics/vector/solid/bench";
import { Rod } from "@repo/design-system/components/contents/physics/vector/solid/rod";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import type { CoordinateTuple } from "@repo/design-system/components/three/frame";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { ExtrudeGeometry, Path, Shape } from "three";

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

/** The brass quadrant at the hinge: its outer radius, the width of its scale, and its thickness. */
const QUADRANT = { band: 0.045, radius: 0.19, thick: 0.0025 } as const;

/** A quarter-circle plate with a window cut out, leaving two arms and the scale's band. */
function quadrantGeometry() {
  const plate = new Shape();
  plate.moveTo(0, 0);
  plate.absarc(0, 0, QUADRANT.radius, 0, Math.PI / 2, false);
  plate.closePath();
  const inner = QUADRANT.radius - QUADRANT.band;
  const arm = 0.022;
  const lean = Math.asin(arm / inner);
  const cut = new Path();
  cut.moveTo(arm * 1.6, arm);
  cut.absarc(0, 0, inner, lean, Math.PI / 2 - lean, false);
  cut.lineTo(arm, arm * 1.6);
  cut.closePath();
  plate.holes = [cut];
  return new ExtrudeGeometry(plate, {
    bevelEnabled: false,
    curveSegments: 48,
    depth: QUADRANT.thick,
  });
}

/**
 * The brass quadrant protractor screwed to the bench behind the hinge, in the
 * plank's plane of swing: its scale is engraved every 5 degrees, with a longer
 * line every 10, and the plank's edge reads the ramp angle against it.
 */
function Quadrant() {
  const plate = useMemo(quadrantGeometry, []);
  useEffect(() => () => plate.dispose(), [plate]);

  return (
    <group position={[HINGE[0], HINGE[1], -0.108]}>
      <mesh castShadow geometry={plate}>
        <SurfaceMaterial
          bump={0.2}
          color={INSTRUMENT_COLORS.brass}
          metalness={0.55}
          repeat={[2, 2]}
          roughness={0.5}
          surface="brushed"
        />
      </mesh>
      {Arr.map(Arr.range(0, 18), (step) => {
        const turn = (step * 5 * Math.PI) / 180;
        const long = step % 2 === 0 ? 0.022 : 0.012;
        const reach = QUADRANT.radius - 0.004 - long / 2;
        return (
          <mesh
            key={step}
            position={[
              Math.cos(turn) * reach,
              Math.sin(turn) * reach,
              QUADRANT.thick + 0.0004,
            ]}
            rotation={[0, 0, turn]}
          >
            <planeGeometry args={[long, step % 2 === 0 ? 0.0022 : 0.0014]} />
            <meshBasicMaterial color={INSTRUMENT_COLORS.graphite} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * The hinged plywood plank on the bench, its brass hinge at the foot, and
 * the retort stand that props up its far end: a painted cast-iron base, a
 * steel rod, and a boss clamp holding a cross rod under the plank.
 */
function Ramp({ angle }: { readonly angle: number }) {
  const turn = (angle * Math.PI) / 180;
  const middle = onPlank(angle, PLANK / 2, -THICK / 2);
  const top = onPlank(angle, PLANK - 0.04, -THICK);
  return (
    <group>
      <Bench />
      <Quadrant />
      <RoundedBox
        args={[PLANK, THICK, 0.2]}
        castShadow
        position={middle}
        radius={0.003}
        receiveShadow
        rotation={[0, 0, turn]}
        smoothness={2}
      >
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.pine}
          repeat={[4, 1]}
          surface="wood"
        />
      </RoundedBox>
      {Arr.map([0.07, -0.07], (z) => (
        <mesh castShadow key={z} position={[HINGE[0] + 0.02, 0.0015, z]}>
          <boxGeometry args={[0.07, 0.003, 0.035]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.brass}
            metalness={1}
            roughness={0.35}
            surface="brushed"
          />
        </mesh>
      ))}
      <mesh position={[HINGE[0], 0.006, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.22, 16]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.brass}
          metalness={1}
          roughness={0.45}
          surface="brushed"
        />
      </mesh>
      {top[1] > 0.01 ? (
        <group>
          <Rod
            color={CAR_COLORS.chrome}
            from={[top[0], 0.02, 0.11]}
            metalness={1}
            radius={0.006}
            surface="brushed"
            to={[top[0], top[1] + 0.08, 0.11]}
          />
          <Rod
            color={CAR_COLORS.chrome}
            from={[top[0], top[1], 0.11]}
            metalness={1}
            radius={0.0055}
            surface="brushed"
            to={[top[0], top[1], -0.06]}
          />
          <RoundedBox
            args={[0.03, 0.03, 0.03]}
            castShadow
            position={[top[0], top[1], 0.11]}
            radius={0.004}
            smoothness={2}
          >
            <SurfaceMaterial
              color={CAR_COLORS.castIron}
              metalness={1}
              roughness={0.6}
              surface="brushed"
            />
          </RoundedBox>
          <RoundedBox
            args={[0.18, 0.018, 0.12]}
            castShadow
            position={[top[0], 0.009, 0.11]}
            radius={0.005}
            receiveShadow
            smoothness={2}
          >
            <SurfaceMaterial color={MACHINE_COLORS.standBlue} surface="paint" />
          </RoundedBox>
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
        fontSize={0.034}
        position={[vector[0] * 1.14, vector[1] * 1.14 - 0.008, 0.05]}
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

  useVisualStop(() => {
    motion.current = { along: START, rest: 0, speed: 0 };
  });

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
        <RoundedBox
          args={[...BLOCK]}
          castShadow
          radius={0.004}
          receiveShadow
          rotation={[0, 0, turn]}
          smoothness={2}
        >
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.oak}
            repeat={[1, 1]}
            surface="wood"
          />
        </RoundedBox>
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

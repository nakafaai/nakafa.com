import { useFrame } from "@react-three/fiber";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { Lead } from "@repo/design-system/components/contents/physics/bench/lead";
import { Stand } from "@repo/design-system/components/contents/physics/bench/stand";
import { Thermometer } from "@repo/design-system/components/contents/physics/bench/thermometer";
import { heatingTemperature } from "@repo/design-system/components/contents/physics/heat/thermal";
import { useCycleClock } from "@repo/design-system/components/contents/simulation/clock";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Turn } from "@repo/design-system/components/three/form/part";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";

/** Seconds the whole heating plays over, and how long it rests on its end. */
const PLAY_SECONDS = 9;
const HOLD_SECONDS = 2;
/** How many readings the heating is cut into for the thermometer's reading and the chart. */
const HEATING_STEPS = 60;

/** The beaker: its inside radius, its height, and how deep the melt stands before and after the solid has melted. */
const RADIUS = 0.46;
const HEIGHT = 0.98;
const POOL = 0.1;
const FULL = 0.46;
/** How tall the heap of solid stands at the start. */
const SOLID = { height: 0.5 } as const;
/** The thermometer: where it stands, how tall it is, and how far its scale reaches below the melting point and above the final temperature. */
const THERMOMETER = { tall: 1.5, x: 0.2, y: 0.12 } as const;
const BELOW = 30;
const ABOVE = 10;
const BUBBLES = 16;

/** The lumps of solid heaped in the beaker, each with its place in the heap, its turn and its size. */
const LUMPS = Arr.makeBy(9, (index) => {
  const angle = (index / 9) * Math.PI * 2 + hashUnit(index, 21);
  const reach = index === 0 ? 0 : 0.2 + hashUnit(index, 22) * 0.06;
  return {
    at: [
      Math.cos(angle) * reach,
      (index % 3) * 0.13 - 0.12 + hashUnit(index, 23) * 0.04,
      Math.sin(angle) * reach,
    ],
    key: index,
    size: [
      0.13 + hashUnit(index, 24) * 0.05,
      0.11 + hashUnit(index, 25) * 0.04,
      0.13 + hashUnit(index, 26) * 0.05,
    ],
    turn: [hashUnit(index, 27) * 3, hashUnit(index, 28) * 3, 0],
  } as const;
});

const BEAKER = [
  [0, 0.012],
  [RADIUS - 0.03, 0.012],
  [RADIUS + 0.012, 0.05],
  [RADIUS + 0.012, HEIGHT - 0.03],
  [RADIUS + 0.04, HEIGHT],
] as const;
const ELEMENT = [
  [-0.2, 1.34, 0],
  [-0.2, 0.3, 0],
  [-0.2, 0.12, 0.05],
  [-0.12, 0.08, 0.12],
  [-0.03, 0.12, 0.05],
  [-0.03, 0.3, 0],
  [-0.03, 0.42, 0],
] as const;
const CABLE = [
  [-0.2, 1.5, 0],
  [-0.24, 1.72, -0.05],
  [-0.6, 1.6, -0.3],
  [-1.1, 0.5, -0.7],
  [-1.5, 0.04, -1],
  [-2.4, 0.03, -1.3],
] as const;

/**
 * The heating on the bench: a beaker on a heat-proof mat with an immersion
 * heater hooked over its rim, a block of solid that sinks into its own melt
 * while it melts, and a thermometer held in the melt by a retort stand. The
 * thread stands still while the solid melts and climbs once it has all
 * melted. `progress` is the share of the heating that has passed, which the
 * scene advances while the card plays and reports through `onProgress`.
 */
export function HeatingCurveScene({
  melt,
  melting,
  onProgress,
  progress,
  top,
  warm,
}: {
  readonly melt: number;
  readonly melting: number;
  readonly onProgress: (progress: number) => void;
  readonly progress: number;
  readonly top: number;
  readonly warm: number;
}) {
  const quantity = useQuantity();
  const clock = useCycleClock({
    holdSeconds: HOLD_SECONDS,
    onValue: onProgress,
    rate: 1 / PLAY_SECONDS,
    steps: HEATING_STEPS,
    total: 1,
    value: progress,
  });
  const solid = useRef<Group>(null);
  const pool = useRef<Mesh>(null);
  const thread = useRef<Group>(null);
  const bubbles = useRef<Group>(null);
  const seeds = useMemo(
    () =>
      Arr.makeBy(BUBBLES, (index) => ({
        key: index,
        pace: 0.5 + hashUnit(index, 5) * 0.5,
        phase: hashUnit(index, 6),
        x: -0.115 + (hashUnit(index, 7) - 0.5) * 0.2,
        z: 0.04 + (hashUnit(index, 8) - 0.5) * 0.16,
      })),
    []
  );
  const heating = { melt, melting, top, warm };
  const low = melting - BELOW;
  const range = top + ABOVE - low;
  const share = (heatingTemperature(heating, progress) - low) / range;

  useFrame((state) => {
    const now = clock.current;
    const melted = Math.min((now * (melt + warm)) / melt, 1);
    const level = POOL + (FULL - POOL) * melted;
    const left = 1 - melted;
    if (solid.current !== null) {
      solid.current.visible = left > 0.02;
      solid.current.scale.set(
        0.4 + 0.6 * Math.sqrt(left),
        Math.max(left, 0.001) ** 0.6,
        0.4 + 0.6 * Math.sqrt(left)
      );
      solid.current.position.y = 0.05 + (SOLID.height * left) / 2;
    }
    if (pool.current !== null) {
      pool.current.scale.y = level;
      pool.current.position.y = 0.05 + level / 2;
    }
    if (thread.current !== null) {
      thread.current.scale.y = Math.max(
        0.02,
        (heatingTemperature(heating, now) - low) / range
      );
    }
    Arr.forEach(bubbles.current?.children ?? [], (bubble, index) => {
      const seed = seeds[index];
      if (seed === undefined) {
        return;
      }
      const rise = (state.clock.elapsedTime * seed.pace + seed.phase) % 1;
      bubble.visible = now > 0 && now < 1 && 0.1 + rise * level < level;
      bubble.position.set(seed.x, 0.12 + rise * (level - 0.06), seed.z);
    });
  });

  return (
    <group>
      <BenchCamera
        narrow={[0.9, 2, 6.4]}
        target={[0.25, 0.95, 0]}
        wide={[0.9, 1.6, 4.6]}
      />
      <mesh castShadow position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.04, 1.3]} />
        <meshStandardMaterial
          color={APPARATUS_COLORS.caseDark}
          roughness={0.9}
        />
      </mesh>
      <group position={[0, 0.04, 0]}>
        <mesh ref={pool} renderOrder={1}>
          <cylinderGeometry args={[RADIUS, RADIUS - 0.02, 1, 48]} />
          <LiquidMaterial color={APPARATUS_COLORS.waxMelt} opacity={0.62} />
        </mesh>
        <group ref={solid}>
          {Arr.map(LUMPS, (lump) => (
            <mesh
              castShadow
              key={lump.key}
              position={lump.at}
              rotation={lump.turn}
              scale={lump.size}
            >
              <icosahedronGeometry args={[1, 2]} />
              <meshPhysicalMaterial
                clearcoat={0.25}
                clearcoatRoughness={0.6}
                color={APPARATUS_COLORS.wax}
                roughness={0.6}
              />
            </mesh>
          ))}
        </group>
        <group ref={bubbles}>
          {Arr.map(seeds, (seed) => (
            <mesh key={seed.key}>
              <sphereGeometry args={[0.012, 8, 6]} />
              <meshStandardMaterial
                color={APPARATUS_COLORS.bubble}
                opacity={0.7}
                roughness={0.1}
                transparent
              />
            </mesh>
          ))}
        </group>
        <Lead
          color={APPARATUS_COLORS.heaterSheath}
          points={ELEMENT}
          radius={0.024}
        />
        <mesh castShadow position={[-0.2, 1.42, 0]}>
          <cylinderGeometry args={[0.05, 0.04, 0.2, 20]} />
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={APPARATUS_COLORS.bakelite}
            roughness={0.4}
          />
        </mesh>
        <mesh castShadow position={[-0.2, 1.3, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.03, 24]} />
          <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.3} />
        </mesh>
        <mesh castShadow renderOrder={3}>
          <Turn profile={BEAKER} />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.2} />
        </mesh>
      </group>
      <Lead color={APPARATUS_COLORS.leadBlack} points={CABLE} radius={0.022} />
      <group position={[THERMOMETER.x, THERMOMETER.y, 0.1]}>
        <Thermometer share={share} tall={THERMOMETER.tall} thread={thread}>
          <InlineMath
            math={`\\theta=${quantity(heatingTemperature(heating, progress), "^\\circ\\text{C}", 1)}`}
          />
        </Thermometer>
      </group>
      <group position={[1.05, 0, 0.1]}>
        <Stand height={1.3} reach={0.8} tall={1.9} />
      </group>
    </group>
  );
}

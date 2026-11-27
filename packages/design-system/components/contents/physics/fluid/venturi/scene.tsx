import { useFrame } from "@react-three/fiber";
import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import { Vector } from "@repo/design-system/components/contents/physics/bench/vector";
import {
  Column,
  Tube,
} from "@repo/design-system/components/contents/physics/bench/vessel";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Turn } from "@repo/design-system/components/three/form/part";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

/** The pipe: half its length, the radius of its wide part, how high its axis lies, and where its throat begins and ends. */
const HALF = 1.7;
const WIDE = 0.27;
const AXIS = 0.62;
const TAPER = 0.8;
const THROAT = 0.34;
/** How many tracer specks ride the flow, and how fast one metre a second carries them. */
const SPECKS = 46;
const PACE = 0.55;
/** Where the gauge tube of the wide part stands, how tall the gauge tubes are, and how high the wide part's column stands. */
const WIDE_TAP = -1.2;
const GAUGE = 1.5;
const HEAD = 1.2;

/** The inside radius of the pipe at `x` along it: wide, then tapering to the throat `narrow` wide, then wide again. */
function bore(x: number, narrow: number) {
  const along = Math.abs(x);
  if (along >= TAPER) {
    return WIDE;
  }
  if (along <= THROAT) {
    return narrow;
  }
  const share = (along - THROAT) / (TAPER - THROAT);
  return narrow + (WIDE - narrow) * share * share * (3 - 2 * share);
}

/** The outline of the pipe's wall or of the water in it, as radii along its length, `inset` inside the glass. */
function outline(narrow: number, inset: number) {
  return Arr.makeBy(49, (index) => {
    const x = -HALF + (index / 48) * HALF * 2;
    return [bore(x, narrow) - inset, x] as const;
  });
}

/**
 * The Venturi tube on its two saddles: a horizontal glass pipe that narrows
 * to a throat halfway, full of water, with an open gauge tube standing on
 * the wide part and another on the throat. While the card plays, tracer
 * specks ride the flow and race through the throat. The throat's column
 * stands lower than the wide part's by the drop the faster water causes.
 */
export function VenturiScene({
  drop,
  faster,
  most,
  ratio,
  speed,
}: {
  readonly drop: number;
  readonly faster: number;
  /** The largest drop the gauge tubes are scaled to show, in metres. */
  readonly most: number;
  /** The throat's diameter over the wide part's. */
  readonly ratio: number;
  readonly speed: number;
}) {
  const quantity = useQuantity();
  const playing = useVisualScene((card) => card.playing, false);
  const narrow = Math.max(0.07, WIDE * ratio);
  const wall = useMemo(() => outline(narrow, -0.014), [narrow]);
  const water = useMemo(() => outline(narrow, 0.004), [narrow]);
  const seeds = useMemo(
    () =>
      Arr.makeBy(SPECKS, (index) => ({
        angle: hashUnit(index, 1) * Math.PI * 2,
        key: index,
        reach: Math.sqrt(hashUnit(index, 2)) * 0.82,
        start: (hashUnit(index, 3) * 2 - 1) * HALF,
      })),
    []
  );
  const specks = useRef<Group>(null);
  const fall = (drop / Math.max(most, 0.01)) * 0.86;
  const wideTop = AXIS + HEAD;
  const narrowTop = Math.max(AXIS + narrow + 0.06, wideTop - fall);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    const step = simulationStep(delta) * speed * PACE;
    Arr.forEach(specks.current?.children ?? [], (speck, index) => {
      const seed = seeds[index];
      if (seed === undefined) {
        return;
      }
      const here = bore(speck.position.y, narrow);
      const next = speck.position.y + step * (WIDE / here) ** 2;
      const x = next > HALF ? -HALF : next;
      const radius = bore(x, narrow) * seed.reach;
      speck.position.set(
        Math.cos(seed.angle) * radius,
        x,
        Math.sin(seed.angle) * radius
      );
    });
  });

  return (
    <group>
      <BenchCamera
        narrow={[0, 1.9, 6.8]}
        target={[0, 1.02, 0]}
        wide={[0, 1.5, 4.7]}
      />
      <SeamlessBenchSurface />
      {Arr.map([-1.25, 1.25] as const, (x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh castShadow position={[0, 0.02, 0]} receiveShadow>
            <boxGeometry args={[0.4, 0.04, 0.7]} />
            <MetalMaterial
              color={APPARATUS_COLORS.caseSteel}
              roughness={0.42}
            />
          </mesh>
          <mesh castShadow position={[0, (AXIS - WIDE) / 2, 0]}>
            <boxGeometry args={[0.1, AXIS - WIDE, 0.36]} />
            <MetalMaterial
              color={APPARATUS_COLORS.caseSteel}
              roughness={0.42}
            />
          </mesh>
        </group>
      ))}
      <group position={[0, AXIS, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <mesh renderOrder={1}>
          <Turn profile={water} />
          <LiquidMaterial color={APPARATUS_COLORS.water} opacity={0.42} />
        </mesh>
        <group ref={specks}>
          {Arr.map(seeds, (seed) => (
            <mesh
              key={seed.key}
              position={[
                Math.cos(seed.angle) * bore(seed.start, narrow) * seed.reach,
                seed.start,
                Math.sin(seed.angle) * bore(seed.start, narrow) * seed.reach,
              ]}
            >
              <sphereGeometry args={[0.016, 10, 8]} />
              <meshStandardMaterial
                color={APPARATUS_COLORS.tracer}
                emissive={APPARATUS_COLORS.tracer}
                emissiveIntensity={0.9}
              />
            </mesh>
          ))}
        </group>
        <mesh castShadow renderOrder={3}>
          <Turn profile={wall} />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.2} />
        </mesh>
        {Arr.map([-HALF, HALF] as const, (end) => (
          <mesh castShadow key={end} position={[0, end, 0]}>
            <cylinderGeometry args={[WIDE + 0.07, WIDE + 0.07, 0.07, 40]} />
            <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.28} />
          </mesh>
        ))}
      </group>
      <group position={[WIDE_TAP, 0, 0]}>
        <Tube bottom={AXIS + WIDE} height={GAUGE - WIDE} radius={0.05} />
        <Column
          bottom={AXIS + WIDE - 0.02}
          color={APPARATUS_COLORS.dyedWater}
          level={wideTop}
          radius={0.05}
        />
      </group>
      <group>
        <Tube bottom={AXIS + narrow} height={GAUGE - narrow} radius={0.05} />
        <Column
          bottom={AXIS + narrow - 0.02}
          color={APPARATUS_COLORS.dyedWater}
          level={narrowTop}
          radius={0.05}
        />
      </group>
      <Tag position={[WIDE_TAP, AXIS - WIDE - 0.16, 0.3]}>
        <InlineMath math={`v_1=${quantity(speed, "\\text{ m s}^{-1}", 2)}`} />
      </Tag>
      <Tag position={[0.12, AXIS - WIDE - 0.16, 0.3]}>
        <InlineMath math={`v_2=${quantity(faster, "\\text{ m s}^{-1}", 2)}`} />
      </Tag>
      <Vector
        color={APPARATUS_COLORS.weightArrow}
        from={[0.28, wideTop, 0]}
        to={[0.28, narrowTop, 0]}
      >
        <InlineMath
          math={`\\Delta h=${quantity(drop * 100, "\\text{ cm}", 1)}`}
        />
      </Vector>
    </group>
  );
}

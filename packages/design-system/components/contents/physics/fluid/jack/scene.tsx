import { useFrame } from "@react-three/fiber";
import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { Gauge } from "@repo/design-system/components/contents/physics/bench/gauge";
import { Vector } from "@repo/design-system/components/contents/physics/bench/vector";
import { Tube } from "@repo/design-system/components/contents/physics/bench/vessel";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group, Mesh } from "three";

/** Seconds the small piston takes to travel its stroke one way. */
const STROKE_SECONDS = 2.4;
/** Where the two cylinders stand, how wide the large one is, where the oil starts, and how far the small piston travels. */
const SMALL_X = -1.05;
const LARGE_X = 0.7;
const LARGE_RADIUS = 0.6;
const FOOT = 0.26;
const SMALL_REST = 1.1;
const LARGE_REST = 0.7;
const TRAVEL = 0.6;
/** How many specks of oil show the flow through the pipe that joins the cylinders. */
const SPECKS = 9;
const WEIGHTS = [0.12, 0.3, 0.46] as const;

/**
 * The hydraulic jack on the bench, each glass cylinder as wide as its piston:
 * a narrow one with a push rod on the left and a wide one carrying a stack of
 * iron weights on the right, joined at the foot by an oil pipe with a
 * pressure gauge. While the card plays the small piston is pushed down its
 * stroke and let up again: the oil it moves runs through the pipe, and the
 * wide piston rises only as far as that volume spreads over its area.
 */
export function HydraulicJackScene({
  force,
  gauge,
  lifted,
  pressure,
  ratio,
}: {
  readonly force: number;
  /** The pressure as a share of the gauge's full scale. */
  readonly gauge: number;
  readonly lifted: number;
  readonly pressure: number;
  /** The small piston's area over the large piston's. */
  readonly ratio: number;
}) {
  const quantity = useQuantity();
  const playing = useVisualScene((card) => card.playing, false);
  const clock = useRef(0);
  const smallPiston = useRef<Group>(null);
  const largePiston = useRef<Group>(null);
  const smallOil = useRef<Mesh>(null);
  const largeOil = useRef<Mesh>(null);
  const specks = useRef<Group>(null);
  const smallRadius = Math.max(0.07, LARGE_RADIUS * Math.sqrt(ratio));

  const place = () => {
    const push = clock.current < 1 ? clock.current : 2 - clock.current;
    const small = SMALL_REST - push * TRAVEL;
    const large = LARGE_REST + push * TRAVEL * ratio;
    smallPiston.current?.position.setY(small);
    largePiston.current?.position.setY(large);
    if (smallOil.current !== null) {
      smallOil.current.scale.y = small - FOOT;
      smallOil.current.position.y = (small + FOOT) / 2;
    }
    if (largeOil.current !== null) {
      largeOil.current.scale.y = large - FOOT;
      largeOil.current.position.y = (large + FOOT) / 2;
    }
    Arr.forEach(specks.current?.children ?? [], (speck, index) => {
      const along = (index / SPECKS + push * 1.5) % 1;
      speck.position.x = SMALL_X + along * (LARGE_X - SMALL_X);
    });
  };

  useVisualStop(() => {
    clock.current = 0;
    place();
  });

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current =
      (clock.current + simulationStep(delta) / STROKE_SECONDS) % 2;
    place();
  });

  return (
    <group>
      <BenchCamera
        narrow={[0.2, 2.2, 6.6]}
        target={[-0.1, 0.9, 0]}
        wide={[0.3, 1.7, 4.6]}
      />
      <SeamlessBenchSurface />
      <mesh castShadow position={[-0.18, FOOT / 2, 0]} receiveShadow>
        <boxGeometry args={[3.3, FOOT, 1.36]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          clearcoatRoughness={0.4}
          color={APPARATUS_COLORS.caseSteel}
          metalness={0.5}
          roughness={0.45}
        />
      </mesh>
      <mesh
        position={[(SMALL_X + LARGE_X) / 2, FOOT + 0.09, 0.42]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.07, 0.07, LARGE_X - SMALL_X, 28, 1, true]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.24} />
      </mesh>
      <mesh
        position={[(SMALL_X + LARGE_X) / 2, FOOT + 0.09, 0.42]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.056, 0.056, LARGE_X - SMALL_X, 24]} />
        <LiquidMaterial color={APPARATUS_COLORS.hydraulicOil} opacity={0.72} />
      </mesh>
      {Arr.map([SMALL_X, LARGE_X] as const, (x) => (
        <mesh castShadow key={x} position={[x, FOOT + 0.09, 0.42]}>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.3} />
        </mesh>
      ))}
      <group ref={specks}>
        {Arr.makeBy(SPECKS, (index) => (
          <mesh
            key={index}
            position={[
              SMALL_X + (index / SPECKS) * (LARGE_X - SMALL_X),
              FOOT + 0.09 + (index % 3 === 0 ? 0.02 : -0.014),
              0.42 + (index % 2 === 0 ? 0.016 : -0.018),
            ]}
          >
            <sphereGeometry args={[0.014, 10, 8]} />
            <meshStandardMaterial
              color={APPARATUS_COLORS.tracer}
              emissive={APPARATUS_COLORS.lampHalo}
              emissiveIntensity={1.2}
            />
          </mesh>
        ))}
      </group>
      <group position={[(SMALL_X + LARGE_X) / 2 - 0.1, FOOT + 0.16, 0.42]}>
        <Gauge share={gauge}>
          <InlineMath
            math={`p=${quantity(pressure / 1000, "\\text{ kPa}", 0)}`}
          />
        </Gauge>
      </group>
      <group position={[SMALL_X, 0, 0]}>
        <Tube bottom={FOOT} height={1.25} radius={smallRadius} />
        <mesh
          position={[0, (SMALL_REST + FOOT) / 2, 0]}
          ref={smallOil}
          scale={[1, SMALL_REST - FOOT, 1]}
        >
          <cylinderGeometry args={[smallRadius, smallRadius, 1, 28]} />
          <LiquidMaterial
            color={APPARATUS_COLORS.hydraulicOil}
            opacity={0.72}
          />
        </mesh>
        <group position={[0, SMALL_REST, 0]} ref={smallPiston}>
          <mesh castShadow position={[0, 0.03, 0]}>
            <cylinderGeometry
              args={[smallRadius - 0.004, smallRadius - 0.004, 0.06, 28]}
            />
            <MetalMaterial
              color={QUANTUM_COLORS.pistonMetal}
              roughness={0.25}
            />
          </mesh>
          <mesh castShadow position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.74, 14]} />
            <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.2} />
          </mesh>
          <mesh castShadow position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.04, 28]} />
            <meshPhysicalMaterial
              clearcoat={0.4}
              color={APPARATUS_COLORS.bakelite}
              roughness={0.45}
            />
          </mesh>
          <Vector
            color={APPARATUS_COLORS.weightArrow}
            from={[0, 1.42, 0]}
            mark="tail"
            to={[0, 0.86, 0]}
          >
            <InlineMath math={`F_1=${quantity(force, "\\text{ N}", 0)}`} />
          </Vector>
        </group>
      </group>
      <group position={[LARGE_X, 0, 0]}>
        <Tube bottom={FOOT} height={0.86} radius={LARGE_RADIUS} />
        <mesh
          position={[0, (LARGE_REST + FOOT) / 2, 0]}
          ref={largeOil}
          scale={[1, LARGE_REST - FOOT, 1]}
        >
          <cylinderGeometry args={[LARGE_RADIUS, LARGE_RADIUS, 1, 48]} />
          <LiquidMaterial
            color={APPARATUS_COLORS.hydraulicOil}
            opacity={0.72}
          />
        </mesh>
        <group position={[0, LARGE_REST, 0]} ref={largePiston}>
          <mesh castShadow position={[0, 0.05, 0]}>
            <cylinderGeometry
              args={[LARGE_RADIUS - 0.006, LARGE_RADIUS - 0.006, 0.1, 48]}
            />
            <MetalMaterial
              color={QUANTUM_COLORS.pistonMetal}
              roughness={0.25}
            />
          </mesh>
          {Arr.map(WEIGHTS, (y, index) => (
            <mesh castShadow key={y} position={[0, y + 0.07, 0]}>
              <cylinderGeometry
                args={[0.46 - index * 0.07, 0.48 - index * 0.07, 0.15, 40]}
              />
              <meshStandardMaterial
                color={APPARATUS_COLORS.caseDark}
                metalness={0.7}
                roughness={0.5}
              />
            </mesh>
          ))}
        </group>
      </group>
      <Vector
        color={APPARATUS_COLORS.forceArrow}
        from={[LARGE_X + LARGE_RADIUS + 0.2, 0.75, 0.2]}
        to={[LARGE_X + LARGE_RADIUS + 0.2, 1.4, 0.2]}
      >
        <InlineMath math={`F_2=${quantity(lifted, "\\text{ N}", 0)}`} />
      </Vector>
    </group>
  );
}

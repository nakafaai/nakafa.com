import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  AnalogPressureGauge,
  MachinedRateArrows,
  PressureReactor,
} from "@repo/design-system/components/contents/chemistry/equilibrium/geometry";
import type { DynamicSystem } from "@repo/design-system/components/contents/chemistry/equilibrium/model";
import { MAX_SIMULATION_TIME } from "@repo/design-system/components/contents/chemistry/equilibrium/model";
import { MoleculeCluster } from "@repo/design-system/components/contents/chemistry/equilibrium/molecules";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { EQUILIBRIUM_COLORS } from "@repo/design-system/lib/material/equilibrium";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr, Match } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

const BENCH_Z = 0.04;
const MIN_MOLECULES = 12;
const MAX_MOLECULES = 38;

function moleculeSeed(index: number) {
  const angle = index * 2.399_96;
  const radius = 0.011 + ((index * 11) % 9) * 0.0052;
  const y = 0.052 + ((index * 17) % 12) * 0.0124;
  return {
    id: `mol-${index}`,
    position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius] as const,
    rotation: [
      (index * 0.83) % (Math.PI * 2),
      (index * 1.17) % (Math.PI * 2),
      (index * 0.59) % (Math.PI * 2),
    ] as const,
  };
}

function ReactorCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.02, 0.29, 0.88] : [0.02, 0.24, 0.69]}
      cameraTarget={[0.01, 0.165, BENCH_Z]}
      fov={38}
      maxDistance={1.5}
      minDistance={0.28}
    />
  );
}

/**
 * Bench-scale sealed borosilicate equilibrium pressure reactor with bolted
 * stainless flanges, brass valves, live analog pressure gauge, authentic 3D
 * reactant/product molecules scaled by initial concentration, and machined
 * bidirectional rate arrows.
 */
export function DynamicEquilibriumScene({
  balanced,
  elapsed,
  forwardRate,
  initial = 1,
  initialMax = 2,
  initialMin = 0.2,
  onElapsed,
  productLabel,
  productShare,
  reactantLabel,
  reverseRate,
  system,
}: {
  readonly balanced: boolean;
  readonly elapsed: number;
  readonly forwardRate: number;
  readonly initial?: number;
  readonly initialMax?: number;
  readonly initialMin?: number;
  readonly onElapsed: (next: number) => void;
  readonly productLabel: string;
  readonly productShare: number;
  readonly reactantLabel: string;
  readonly reverseRate: number;
  readonly system: DynamicSystem;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const labelInk = useLabelInk();
  const swarmRef = useRef<Group>(null);
  const clockRef = useRef(elapsed);
  const reportRef = useRef(elapsed);

  const densityRatio =
    initialMax > initialMin
      ? Math.max(
          0,
          Math.min(1, (initial - initialMin) / (initialMax - initialMin))
        )
      : 0.5;
  const visibleCount = Math.round(
    MIN_MOLECULES + densityRatio * (MAX_MOLECULES - MIN_MOLECULES)
  );
  const allParticles = useMemo(
    () => Arr.makeBy(MAX_MOLECULES, moleculeSeed),
    []
  );
  const activeParticles = useMemo(
    () => Arr.take(allParticles, visibleCount),
    [allParticles, visibleCount]
  );
  const productCount = Math.round(visibleCount * productShare);

  const gasHazeColor = Match.value(system).pipe(
    Match.when("nitrogenDioxide", () => EQUILIBRIUM_COLORS.no2Brown),
    Match.when("hydrogenIodide", () => PROCESS_COLORS.iodineViolet),
    Match.when("generic", () => EQUILIBRIUM_COLORS.vesselGlass),
    Match.exhaustive
  );
  const gasHazeOpacity = Match.value(system).pipe(
    Match.when(
      "nitrogenDioxide",
      () => 0.04 + productShare * (0.35 + densityRatio * 0.65) * 0.34
    ),
    Match.when(
      "hydrogenIodide",
      () => 0.03 + (1 - productShare) * (0.35 + densityRatio * 0.65) * 0.24
    ),
    Match.when("generic", () => 0.04 + densityRatio * 0.05),
    Match.exhaustive
  );

  useFrame((_, delta) => {
    if (!playing) {
      clockRef.current = elapsed;
      if (swarmRef.current !== null) {
        swarmRef.current.position.y = 0;
      }
      return;
    }
    const dt = simulationStep(delta);
    const next = (clockRef.current + dt * 1.4) % MAX_SIMULATION_TIME;
    clockRef.current = next;
    if (Math.abs(next - reportRef.current) >= 0.2) {
      reportRef.current = next;
      onElapsed(Math.round(next * 10) / 10);
    }
    if (swarmRef.current !== null) {
      swarmRef.current.rotation.y +=
        dt * (0.45 + (forwardRate + reverseRate) * 0.28);
      swarmRef.current.position.y = Math.sin(next * 3.8) * 0.0028;
    }
  });

  const forwardScale = Math.min(
    1.42,
    Math.max(0.42, 0.42 + forwardRate * 0.56)
  );
  const reverseScale = Math.min(
    1.42,
    Math.max(0.42, 0.42 + reverseRate * 0.56)
  );

  return (
    <group>
      <SimulationTicker running={playing} />
      <ReactorCamera />
      <LabBench width={2.4} />
      {/* Sealed borosilicate pressure reactor standing on y = 0 */}
      <group position={[0, 0, BENCH_Z]}>
        <PressureReactor
          balanced={balanced}
          gasHazeColor={gasHazeColor}
          gasHazeOpacity={gasHazeOpacity}
        />
        <AnalogPressureGauge pressureRatio={densityRatio} />
        <group ref={swarmRef}>
          {Arr.map(activeParticles, (pt, index) => (
            <MoleculeCluster
              index={index}
              isProduct={index < productCount}
              key={pt.id}
              position={pt.position}
              rotation={pt.rotation}
              system={system}
            />
          ))}
        </group>
        <MachinedRateArrows
          forwardScale={forwardScale}
          reverseScale={reverseScale}
        />
      </group>
      {/* Adaptive theme-aware labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.145, 0.296, BENCH_Z + 0.015]}
      >
        <span>{reactantLabel}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.155, 0.296, BENCH_Z + 0.015]}
      >
        <span>{productLabel}</span>
      </ThreeLabel>
    </group>
  );
}

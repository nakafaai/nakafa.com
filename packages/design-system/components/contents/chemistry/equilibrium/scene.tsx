import { useFrame, useThree } from "@react-three/fiber";
import type { DynamicSystem } from "@repo/design-system/components/contents/chemistry/equilibrium/model";
import { MAX_SIMULATION_TIME } from "@repo/design-system/components/contents/chemistry/equilibrium/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { EQUILIBRIUM_COLORS } from "@repo/design-system/lib/material/equilibrium";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

const PARTICLE_COUNT = 28;

function particleSeed(index: number) {
  const angle = index * 2.399_96;
  const radius = 0.22 + ((index * 11) % 9) * 0.072;
  const y = 0.22 + ((index * 17) % 10) * 0.092;
  return {
    phase: index * 0.7,
    radius,
    x: Math.cos(angle) * radius,
    y,
    z: Math.sin(angle) * radius,
  };
}

function ReactorCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.9, 3.9] : [0, 1.5, 3.05]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.5}
    />
  );
}

export function DynamicEquilibriumScene({
  balanced,
  elapsed,
  forwardRate,
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
  readonly onElapsed: (next: number) => void;
  readonly productLabel: string;
  readonly productShare: number;
  readonly reactantLabel: string;
  readonly reverseRate: number;
  readonly system: DynamicSystem;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const swarmRef = useRef<Group>(null);
  const clockRef = useRef(elapsed);
  const reportRef = useRef(elapsed);

  const particles = useMemo(() => Arr.makeBy(PARTICLE_COUNT, particleSeed), []);
  const productCount = Math.round(PARTICLE_COUNT * productShare);
  const reactantColor =
    system === "nitrogenDioxide"
      ? EQUILIBRIUM_COLORS.n2o4Pale
      : EQUILIBRIUM_COLORS.reactant;
  const productColor =
    system === "nitrogenDioxide"
      ? EQUILIBRIUM_COLORS.no2Brown
      : EQUILIBRIUM_COLORS.product;

  useFrame((_, delta) => {
    if (!playing) {
      clockRef.current = elapsed;
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
        dt * (0.45 + (forwardRate + reverseRate) * 0.25);
    }
  });

  const forwardScale = Math.min(1.4, 0.35 + forwardRate * 0.6);
  const reverseScale = Math.min(1.4, 0.35 + reverseRate * 0.6);

  return (
    <group>
      <SimulationTicker running={playing} />
      <ReactorCamera />
      <mesh castShadow position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[1.1, 1.16, 0.1, 32]} />
        <meshStandardMaterial
          color={EQUILIBRIUM_COLORS.vesselBase}
          roughness={0.55}
        />
      </mesh>
      <mesh position={[0, 0.64, 0]}>
        <cylinderGeometry args={[0.98, 0.98, 1.1, 36]} />
        <meshPhysicalMaterial
          color={
            balanced
              ? EQUILIBRIUM_COLORS.balancedGlow
              : EQUILIBRIUM_COLORS.vesselGlass
          }
          opacity={0.22}
          roughness={0.14}
          transparent
        />
      </mesh>
      <group ref={swarmRef}>
        {Arr.map(particles, (pt, index) => {
          const isProduct = index < productCount;
          return (
            <mesh
              castShadow
              key={pt.phase}
              position={[pt.x, pt.y, pt.z]}
              scale={isProduct ? 1 : 1.18}
            >
              <sphereGeometry args={[0.056, 14, 10]} />
              <meshStandardMaterial
                color={isProduct ? productColor : reactantColor}
                roughness={0.38}
              />
            </mesh>
          );
        })}
      </group>
      {/* Bidirectional rate arrows */}
      <group position={[0, 1.32, 0]}>
        <mesh position={[0, 0.07, 0]} scale={[forwardScale, 1, 1]}>
          <boxGeometry args={[0.75, 0.045, 0.045]} />
          <meshStandardMaterial
            color={EQUILIBRIUM_COLORS.forwardArrow}
            roughness={0.4}
          />
        </mesh>
        <mesh
          position={[0.42 * forwardScale, 0.07, 0]}
          rotation={[0, 0, -Math.PI / 2]}
        >
          <coneGeometry args={[0.065, 0.14, 10]} />
          <meshStandardMaterial
            color={EQUILIBRIUM_COLORS.forwardArrow}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0, -0.07, 0]} scale={[reverseScale, 1, 1]}>
          <boxGeometry args={[0.75, 0.045, 0.045]} />
          <meshStandardMaterial
            color={EQUILIBRIUM_COLORS.reverseArrow}
            roughness={0.4}
          />
        </mesh>
        <mesh
          position={[-0.42 * reverseScale, -0.07, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <coneGeometry args={[0.065, 0.14, 10]} />
          <meshStandardMaterial
            color={EQUILIBRIUM_COLORS.reverseArrow}
            roughness={0.4}
          />
        </mesh>
      </group>
      <ThreeLabel
        color={EQUILIBRIUM_COLORS.labelInk}
        fontSize="compact"
        position={[-0.92, 1.18, 0.2]}
      >
        <span>{reactantLabel}</span>
      </ThreeLabel>
      <ThreeLabel
        color={EQUILIBRIUM_COLORS.labelInk}
        fontSize="compact"
        position={[0.92, 1.18, 0.2]}
      >
        <span>{productLabel}</span>
      </ThreeLabel>
    </group>
  );
}

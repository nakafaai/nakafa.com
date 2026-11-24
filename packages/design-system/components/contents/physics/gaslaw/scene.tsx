import { useFrame, useThree } from "@react-three/fiber";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function GasLawCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [1.65, 1.5, 3.2] : [1.3, 1.25, 2.5]}
      cameraTarget={[0, 0.62, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.3}
    />
  );
}

export function GasLawScene({
  effectiveVolumeL,
  parts,
  temperatureK,
}: {
  readonly effectiveVolumeL: number;
  readonly parts: Readonly<
    Record<"cylinder" | "gauge" | "heater" | "molecules" | "piston", string>
  >;
  readonly temperatureK: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const particlesRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const pistonY = 0.42 + Math.min(0.76, (effectiveVolumeL / 22) * 0.76);
  const seeds = useMemo(
    () =>
      Arr.makeBy(14, (index) => ({
        angle: index * 1.9,
        id: `m-${index}`,
        r: 0.14 + (index % 3) * 0.12,
        speed: 1.4 + (index % 4) * 0.45,
      })),
    []
  );

  useFrame((_, delta) => {
    if (!playing || particlesRef.current === null) {
      return;
    }
    const thermalSpeed = Math.sqrt(Math.max(100, temperatureK) / 300);
    phaseRef.current += simulationStep(delta) * 2.4 * thermalSpeed;
    for (let i = 0; i < particlesRef.current.children.length; i += 1) {
      const child = particlesRef.current.children[i];
      const seed = seeds[i];
      if (child !== undefined && seed !== undefined) {
        const t = phaseRef.current * seed.speed + seed.angle;
        child.position.set(
          Math.cos(t) * seed.r,
          0.18 + ((Math.sin(t * 1.3) + 1) / 2) * (pistonY - 0.26),
          Math.sin(t) * seed.r
        );
      }
    }
  });

  const gasColor =
    temperatureK > 420 ? QUANTUM_COLORS.gasHot : QUANTUM_COLORS.gasCool;

  return (
    <group>
      <SimulationTicker running={playing} />
      <GasLawCamera />
      {/* Heater base */}
      <mesh castShadow position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[0.64, 0.68, 0.12, 24]} />
        <meshStandardMaterial
          color={
            temperatureK > 340
              ? QUANTUM_COLORS.heaterCoil
              : QUANTUM_COLORS.benchSlate
          }
          roughness={0.55}
        />
      </mesh>
      {/* Glass cylinder */}
      <mesh position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.52, 0.52, 1.12, 28, 1, true]} />
        <meshPhysicalMaterial
          color={QUANTUM_COLORS.glassTube}
          opacity={0.26}
          roughness={0.14}
          side={2}
          transparent
        />
      </mesh>
      {/* Movable piston */}
      <group position={[0, pistonY, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.49, 0.49, 0.09, 24]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.pistonMetal}
            metalness={0.5}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.5, 14]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.pistonMetal}
            metalness={0.5}
            roughness={0.35}
          />
        </mesh>
      </group>
      {/* Pressure gauge on side */}
      <mesh
        castShadow
        position={[0.72, 0.46, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.16, 0.16, 0.08, 20]} />
        <meshStandardMaterial color={QUANTUM_COLORS.brass} roughness={0.38} />
      </mesh>
      {/* Gas molecules */}
      <group ref={particlesRef}>
        {Arr.map(seeds, (seed) => (
          <mesh
            key={seed.id}
            position={[
              Math.cos(seed.angle) * seed.r,
              0.24 + (seed.angle % 0.25),
              Math.sin(seed.angle) * seed.r,
            ]}
          >
            <sphereGeometry args={[0.044, 10, 8]} />
            <meshStandardMaterial color={gasColor} roughness={0.32} />
          </mesh>
        ))}
      </group>
      {/* Labels */}
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[0, pistonY + 0.58, 0]}
      >
        <span>{parts.piston}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[-0.76, 0.72, 0]}
      >
        <span>{parts.cylinder}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[0.96, 0.56, 0]}
      >
        <span>{parts.gauge}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 0.16, 0.2]}
      >
        <span>{parts.heater}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.34, 0.56]}
      >
        <span>{parts.molecules}</span>
      </ThreeLabel>
    </group>
  );
}

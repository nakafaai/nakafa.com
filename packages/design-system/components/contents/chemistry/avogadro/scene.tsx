import { useFrame, useThree } from "@react-three/fiber";
import type { GasCondition } from "@repo/design-system/components/contents/chemistry/avogadro/model";
import { evaluateAvogadroGas } from "@repo/design-system/components/contents/chemistry/avogadro/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function AvogadroCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.35] : [0, 1.32, 2.7]}
      cameraTarget={[0, 0.65, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function AvogadroGasScene({
  condition,
  moles,
  parts,
}: {
  readonly condition: GasCondition;
  readonly moles: number;
  readonly parts: Readonly<
    Record<
      "cylinder" | "gasParticles" | "piston" | "thermometer" | "volumeScale",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const swarmRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluateAvogadroGas(condition, moles);

  const pistonY = Math.min(
    1.1,
    Math.max(0.26, 0.16 + (reading.volumeDm3 / 75) * 0.94)
  );
  const particleCount = Math.min(12, Math.max(3, Math.round(moles * 4)));
  const particles = useMemo(
    () =>
      Arr.makeBy(particleCount, (index) => ({
        id: `g-${index}`,
        x: -0.2 + (index % 3) * 0.2,
        y: 0.12 + ((index + 0.5) / particleCount) * (pistonY - 0.2),
        z: index % 2 === 0 ? -0.1 : 0.1,
      })),
    [particleCount, pistonY]
  );

  useFrame((_, delta) => {
    if (!playing || swarmRef.current === null) {
      return;
    }
    phaseRef.current +=
      simulationStep(delta) * (condition === "rtp" ? 2.4 : 1.6);
    swarmRef.current.rotation.y = Math.sin(phaseRef.current) * 0.22;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <AvogadroCamera />
      {/* Graduated glass gas cylinder */}
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 1.12, 24, 1, true]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.glassClear}
          opacity={0.34}
          side={2}
          transparent
        />
      </mesh>
      {/* Movable metallic piston */}
      <mesh castShadow position={[0, pistonY, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.08, 22]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.alloySteel}
          metalness={0.5}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, pistonY + 0.22, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.38, 12]} />
        <meshStandardMaterial color={PROCESS_COLORS.ironDark} />
      </mesh>
      {/* Gas molecules bouncing beneath piston */}
      <group ref={swarmRef}>
        {Arr.map(particles, (particle) => (
          <mesh
            key={particle.id}
            position={[particle.x, particle.y, particle.z]}
          >
            <sphereGeometry args={[0.044, 12, 10]} />
            <meshStandardMaterial
              color={
                condition === "rtp"
                  ? PROCESS_COLORS.ammoniaCyan
                  : PROCESS_COLORS.coldBlue
              }
              roughness={0.25}
            />
          </mesh>
        ))}
      </group>
      {/* Side thermometer */}
      <mesh position={[0.58, 0.56, 0]}>
        <cylinderGeometry args={[0.032, 0.032, 0.84, 12]} />
        <meshStandardMaterial
          color={
            condition === "rtp"
              ? PROCESS_COLORS.weakAcidOrange
              : PROCESS_COLORS.coldBlue
          }
        />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0, pistonY + 0.48, 0]}
      >
        <span>{parts.piston}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.74, 0.9, 0]}
      >
        <span>{parts.cylinder}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.76, 0.48, 0]}
      >
        <span>{parts.volumeScale}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.88, 0.72, 0]}
      >
        <span>{parts.thermometer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.74, 0.26, 0]}
      >
        <span>{parts.gasParticles}</span>
      </ThreeLabel>
    </group>
  );
}

import { useFrame, useThree } from "@react-three/fiber";
import type { SecretionStep } from "@repo/design-system/components/contents/biology/secretion/model";
import { waypointOf } from "@repo/design-system/components/contents/biology/secretion/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { ENZYME_COLORS } from "@repo/design-system/lib/material/enzyme";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const GOLGI_STACKS = [0, 1, 2] as const;
const RIBOSOME_DOTS = [-0.52, -0.35, -0.18] as const;

function SecretionCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 2.35, 4.15] : [0, 1.85, 3.2]}
      cameraTarget={[0.05, 0.28, 0]}
      fov={38}
      maxDistance={6.5}
      minDistance={1.5}
    />
  );
}

export function SecretionScene({
  activeStep,
  onAdvanceStep,
  parts,
}: {
  readonly activeStep: SecretionStep;
  readonly onAdvanceStep: () => void;
  readonly parts: Readonly<
    Record<
      | "nucleus"
      | "ribosome"
      | "reticulum"
      | "golgi"
      | "vesicle"
      | "membrane"
      | "duct",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const cargoRef = useRef<Group>(null);
  const timer = useRef(0);
  const target = waypointOf(activeStep);

  useFrame((_, delta) => {
    const dt = simulationStep(delta);
    if (playing) {
      timer.current += dt;
      if (timer.current >= 1.6) {
        timer.current = 0;
        onAdvanceStep();
      }
    }
    const cargo = cargoRef.current;
    if (cargo === null) {
      return;
    }
    const blend = Math.min(1, dt * 6);
    cargo.position.x += (target[0] - cargo.position.x) * blend;
    cargo.position.y += (target[1] - cargo.position.y) * blend;
    cargo.position.z += (target[2] - cargo.position.z) * blend;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <SecretionCamera />
      {/* Cutaway acinar cell body */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[2.9, 0.14, 1.7]} />
        <meshStandardMaterial
          color={ENZYME_COLORS.cytoplasm}
          roughness={0.78}
        />
      </mesh>
      <mesh position={[0, 0.16, -0.82]}>
        <boxGeometry args={[2.94, 0.34, 0.08]} />
        <meshStandardMaterial
          color={ENZYME_COLORS.cellShell}
          roughness={0.65}
        />
      </mesh>
      <mesh position={[1.44, 0.16, 0]}>
        <boxGeometry args={[0.08, 0.34, 1.7]} />
        <meshStandardMaterial color={ENZYME_COLORS.ductWall} roughness={0.62} />
      </mesh>

      {/* Nucleus */}
      <mesh castShadow position={[-1.05, 0.36, 0]}>
        <sphereGeometry args={[0.32, 22, 16]} />
        <meshStandardMaterial color={ENZYME_COLORS.nucleus} roughness={0.52} />
      </mesh>

      {/* Rough ER + ribosomes */}
      <group position={[-0.36, 0.24, -0.14]}>
        <mesh castShadow>
          <boxGeometry args={[0.62, 0.14, 0.54]} />
          <meshStandardMaterial
            color={ENZYME_COLORS.reticulum}
            roughness={0.55}
          />
        </mesh>
        {Arr.map(RIBOSOME_DOTS, (x) => (
          <mesh key={x} position={[x + 0.35, 0.1, 0.18]}>
            <sphereGeometry args={[0.032, 10, 8]} />
            <meshStandardMaterial
              color={ENZYME_COLORS.ribosome}
              roughness={0.45}
            />
          </mesh>
        ))}
      </group>

      {/* Golgi apparatus stacks */}
      <group position={[0.42, 0.24, -0.02]}>
        {Arr.map(GOLGI_STACKS, (idx) => (
          <mesh castShadow key={idx} position={[idx * 0.11 - 0.11, 0, 0]}>
            <capsuleGeometry args={[0.042, 0.42, 8, 12]} />
            <meshStandardMaterial
              color={ENZYME_COLORS.golgi}
              roughness={0.52}
            />
          </mesh>
        ))}
      </group>

      {/* Secretory vesicle + moving enzyme cargo */}
      <group position={[target[0], target[1], target[2]]} ref={cargoRef}>
        <mesh castShadow>
          <sphereGeometry args={[0.13, 18, 14]} />
          <meshPhysicalMaterial
            color={ENZYME_COLORS.vesicle}
            opacity={0.45}
            roughness={0.22}
            transparent
          />
        </mesh>
        <mesh castShadow>
          <dodecahedronGeometry args={[0.075, 1]} />
          <meshStandardMaterial color={ENZYME_COLORS.cargo} roughness={0.38} />
        </mesh>
      </group>

      <ThreeLabel
        color={ENZYME_COLORS.labelInk}
        fontSize="compact"
        position={[-1.05, 0.78, 0]}
      >
        <span>{parts.nucleus}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ENZYME_COLORS.labelInk}
        fontSize="compact"
        position={[-0.45, 0.56, 0.42]}
      >
        <span>{parts.ribosome}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ENZYME_COLORS.labelInk}
        fontSize="compact"
        position={[-0.25, 0.56, -0.48]}
      >
        <span>{parts.reticulum}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ENZYME_COLORS.labelInk}
        fontSize="compact"
        position={[0.42, 0.64, -0.35]}
      >
        <span>{parts.golgi}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ENZYME_COLORS.labelInk}
        fontSize="compact"
        position={[0.92, 0.62, 0.28]}
      >
        <span>{parts.vesicle}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ENZYME_COLORS.labelInk}
        fontSize="compact"
        position={[1.4, 0.44, 0.58]}
      >
        <span>{parts.membrane}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ENZYME_COLORS.labelInk}
        fontSize="compact"
        position={[1.66, 0.68, -0.1]}
      >
        <span>{parts.duct}</span>
      </ThreeLabel>
    </group>
  );
}

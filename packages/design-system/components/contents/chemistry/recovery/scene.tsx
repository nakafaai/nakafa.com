import { useFrame, useThree } from "@react-three/fiber";
import type { CatalysisMode } from "@repo/design-system/components/contents/chemistry/recovery/model";
import { evaluateCatalystRecovery } from "@repo/design-system/components/contents/chemistry/recovery/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { useRef } from "react";
import type { Group } from "three";

function RecoveryCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.45] : [0, 1.32, 2.8]}
      cameraTarget={[0, 0.58, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function GreenCatalystScene({
  cycles,
  mode,
  parts,
}: {
  readonly cycles: number;
  readonly mode: CatalysisMode;
  readonly parts: Readonly<
    Record<
      | "catalystBed"
      | "productOut"
      | "reactantStream"
      | "recoveryLoop"
      | "wasteBin",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const loopBeadRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluateCatalystRecovery(mode, cycles);

  useFrame((_, delta) => {
    if (!playing || loopBeadRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.4;
    const angle = phaseRef.current;
    loopBeadRef.current.position.set(
      Math.cos(angle) * 0.42,
      0.72 + Math.sin(angle) * 0.24,
      0.16
    );
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <RecoveryCamera />
      {/* Feed pipe */}
      <mesh position={[-0.78, 0.58, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.65, 12]} />
        <meshStandardMaterial color={PROCESS_COLORS.ammoniaCyan} />
      </mesh>
      {/* Catalyst bed reactor */}
      <mesh castShadow position={[0, 0.58, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.62, 20]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.catalystTeal}
          roughness={0.4}
        />
      </mesh>
      {/* Recovery loop ring (active for recyclable catalysts) */}
      <mesh position={[0, 0.72, 0]} rotation={[0.2, 0, 0]}>
        <torusGeometry args={[0.42, 0.03, 10, 28]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.greenProduct}
          opacity={reading.recoveredPercent > 0 ? 0.92 : 0.22}
          transparent
        />
      </mesh>
      {reading.recoveredPercent > 0 ? (
        <group position={[0.42, 0.72, 0.16]} ref={loopBeadRef}>
          <mesh>
            <sphereGeometry args={[0.052, 12, 10]} />
            <meshStandardMaterial color={PROCESS_COLORS.electronGold} />
          </mesh>
        </group>
      ) : null}
      {/* Product outlet stream */}
      <mesh position={[0.72, 0.74, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.055, 0.055, 0.58, 12]} />
        <meshStandardMaterial color={PROCESS_COLORS.greenProduct} />
      </mesh>
      {/* Dynamic E-factor waste bin */}
      <mesh castShadow position={[0.72, reading.wasteHeight * 0.5, 0]}>
        <boxGeometry args={[0.38, reading.wasteHeight, 0.34]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.wasteSlate}
          roughness={0.7}
        />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.92, 0.8, 0]}
      >
        <span>{parts.reactantStream}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.22, 0]}
      >
        <span>{parts.recoveryLoop}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.42, 0.24, 0.34]}
      >
        <span>{parts.catalystBed}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.88, 0.96, 0]}
      >
        <span>{parts.productOut}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.84, 0.18, 0.34]}
      >
        <span>{parts.wasteBin}</span>
      </ThreeLabel>
    </group>
  );
}

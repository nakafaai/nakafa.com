import { useFrame, useThree } from "@react-three/fiber";
import type { SaponificationStep } from "@repo/design-system/components/contents/chemistry/kettle/model";
import { evaluateSaponificationStep } from "@repo/design-system/components/contents/chemistry/kettle/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { useRef } from "react";
import type { Group } from "three";

function KettleCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.35] : [0, 1.32, 2.7]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function SaponificationKettleScene({
  parts,
  step,
}: {
  readonly parts: Readonly<
    Record<
      "alkaliStream" | "kettle" | "saltLayer" | "soapCurd" | "triglyceride",
      string
    >
  >;
  readonly step: SaponificationStep;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const paddleRef = useRef<Group>(null);
  const state = evaluateSaponificationStep(step);

  useFrame((_, delta) => {
    if (!playing || paddleRef.current === null) {
      return;
    }
    paddleRef.current.rotation.y += simulationStep(delta) * 2.2;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <KettleCamera />
      {state.isMolded ? (
        <group position={[0, 0.42, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.72, 0.34, 0.46]} />
            <meshStandardMaterial
              color={ORGANIC_COLORS.soapCream}
              roughness={0.45}
            />
          </mesh>
        </group>
      ) : (
        <group>
          {/* Steel boiling kettle */}
          <mesh position={[0, 0.46, 0]}>
            <cylinderGeometry args={[0.48, 0.42, 0.78, 24, 1, true]} />
            <meshStandardMaterial
              color={ORGANIC_COLORS.fabricSlate}
              opacity={0.42}
              side={2}
              transparent
            />
          </mesh>
          {/* Lower triglyceride / brine layer */}
          <mesh position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.4, 0.38, 0.3, 22]} />
            <meshStandardMaterial
              color={
                state.hasBrine
                  ? ORGANIC_COLORS.saltCrystal
                  : ORGANIC_COLORS.triglycerideGold
              }
              opacity={0.82}
              transparent
            />
          </mesh>
          {/* Floating soap curd cake */}
          <mesh castShadow position={[0, 0.44 + state.curdHeight * 0.4, 0]}>
            <cylinderGeometry args={[0.42, 0.4, state.curdHeight, 22]} />
            <meshStandardMaterial color={ORGANIC_COLORS.soapCream} />
          </mesh>
          {/* Rotating agitator shaft */}
          <group position={[0, 0.62, 0]} ref={paddleRef}>
            <mesh>
              <cylinderGeometry args={[0.025, 0.025, 0.85, 10]} />
              <meshStandardMaterial color={ORGANIC_COLORS.carbonDark} />
            </mesh>
            <mesh position={[0, -0.26, 0]}>
              <boxGeometry args={[0.56, 0.06, 0.04]} />
              <meshStandardMaterial color={ORGANIC_COLORS.carbonDark} />
            </mesh>
          </group>
          {/* Alkali feed pipe */}
          <mesh position={[-0.42, 0.96, 0]} rotation={[0, 0, -0.45]}>
            <cylinderGeometry args={[0.042, 0.042, 0.36, 12]} />
            <meshStandardMaterial color={ORGANIC_COLORS.alkaliCyan} />
          </mesh>
        </group>
      )}
      {/* Labels */}
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 1.06, 0]}
      >
        <span>{parts.alkaliStream}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0.72, 0.86, 0]}
      >
        <span>{parts.soapCurd}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[-0.76, 0.56, 0]}
      >
        <span>{parts.kettle}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0.76, 0.28, 0]}
      >
        <span>{state.hasBrine ? parts.saltLayer : parts.triglyceride}</span>
      </ThreeLabel>
    </group>
  );
}

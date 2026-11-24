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
import { useRef } from "react";
import type { Mesh } from "three";

function glowColorForTemp(tempK: number): string {
  if (tempK < 3200) {
    return QUANTUM_COLORS.gasHot;
  }
  if (tempK < 5200) {
    return QUANTUM_COLORS.gasWarm;
  }
  return QUANTUM_COLORS.diffractionRing;
}

function PlanckCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [1.6, 1.5, 3.1] : [1.3, 1.25, 2.45]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.3}
    />
  );
}

export function PlanckCavityScene({
  parts,
  temperatureK,
}: {
  readonly parts: Readonly<
    Record<
      | "cavity"
      | "classicalCurve"
      | "peakMarker"
      | "planckCurve"
      | "visibleBand",
      string
    >
  >;
  readonly temperatureK: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const coreRef = useRef<Mesh>(null);
  const phaseRef = useRef(0);
  const glow = glowColorForTemp(temperatureK);

  useFrame((_, delta) => {
    if (!playing || coreRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 2.4;
    const pulse = 1 + Math.sin(phaseRef.current) * 0.05;
    coreRef.current.scale.set(pulse, pulse, pulse);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <PlanckCamera />
      {/* Insulated blackbody furnace shell */}
      <mesh castShadow position={[0, 0.56, 0]} receiveShadow>
        <boxGeometry args={[1.18, 0.96, 1.04]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.cavityBody}
          roughness={0.62}
        />
      </mesh>
      {/* Glowing cavity aperture */}
      <mesh position={[0, 0.56, 0.53]} ref={coreRef}>
        <sphereGeometry args={[0.26, 20, 16]} />
        <meshStandardMaterial
          color={glow}
          emissive={glow}
          emissiveIntensity={0.85}
          roughness={0.22}
        />
      </mesh>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.18, 0]}
      >
        <span>{parts.cavity}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[0.78, 0.58, 0.45]}
      >
        <span>{parts.peakMarker}</span>
      </ThreeLabel>
    </group>
  );
}

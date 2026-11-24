import { useFrame, useThree } from "@react-three/fiber";
import type { CalorimeterMaterial } from "@repo/design-system/components/contents/physics/calorimeter/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Match } from "effect";
import { useRef } from "react";
import type { Group } from "three";

function sampleColor(material: CalorimeterMaterial): string {
  return Match.value(material).pipe(
    Match.when("water", () => QUANTUM_COLORS.waterLiquid),
    Match.when("aluminium", () => QUANTUM_COLORS.aluminium),
    Match.when("copper", () => QUANTUM_COLORS.copper),
    Match.when("iron", () => QUANTUM_COLORS.iron),
    Match.when("oil", () => QUANTUM_COLORS.oil),
    Match.exhaustive
  );
}

function CalorimeterCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [1.6, 1.65, 3.2] : [1.3, 1.35, 2.5]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.3}
    />
  );
}

export function CalorimeterScene({
  material,
  parts,
  temperatureRiseK,
}: {
  readonly material: CalorimeterMaterial;
  readonly parts: Readonly<
    Record<
      "heater" | "insulation" | "sample" | "stirrer" | "thermometer",
      string
    >
  >;
  readonly temperatureRiseK: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const stirrerRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  useFrame((_, delta) => {
    if (!playing || stirrerRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 3.2;
    stirrerRef.current.position.y = Math.sin(phaseRef.current) * 0.08;
  });

  const mercuryHeight = 0.2 + Math.min(0.65, temperatureRiseK / 90);

  return (
    <group>
      <SimulationTicker running={playing} />
      <CalorimeterCamera />
      {/* Outer insulated jacket */}
      <mesh castShadow position={[0, 0.44, 0]} receiveShadow>
        <cylinderGeometry args={[0.66, 0.66, 0.84, 28, 1, true]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.insulation}
          opacity={0.52}
          roughness={0.72}
          side={2}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <cylinderGeometry args={[0.68, 0.7, 0.08, 28]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.insulation}
          roughness={0.75}
        />
      </mesh>
      {/* Sample cylinder/liquid */}
      <mesh castShadow position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.48, 0.48, 0.68, 24]} />
        <meshStandardMaterial
          color={sampleColor(material)}
          opacity={material === "water" || material === "oil" ? 0.75 : 0.94}
          roughness={0.35}
          transparent={material === "water" || material === "oil"}
        />
      </mesh>
      {/* Immersion heater coil */}
      <mesh castShadow position={[-0.18, 0.62, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.74, 14]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.heaterCoil}
          emissive={QUANTUM_COLORS.heaterCoil}
          emissiveIntensity={0.45}
          roughness={0.35}
        />
      </mesh>
      {/* Thermometer with live rising mercury column */}
      <group position={[0.18, 0.66, 0]}>
        <mesh>
          <cylinderGeometry args={[0.036, 0.036, 0.92, 14]} />
          <meshPhysicalMaterial
            color={QUANTUM_COLORS.glassTube}
            opacity={0.4}
            roughness={0.15}
            transparent
          />
        </mesh>
        <mesh position={[0, -0.42 + mercuryHeight / 2, 0]}>
          <cylinderGeometry args={[0.02, 0.02, mercuryHeight, 10]} />
          <meshStandardMaterial color={QUANTUM_COLORS.proton} roughness={0.3} />
        </mesh>
      </group>
      {/* Stirrer rod */}
      <group position={[0, 0.64, 0.24]} ref={stirrerRef}>
        <mesh>
          <cylinderGeometry args={[0.022, 0.022, 0.78, 10]} />
          <meshStandardMaterial color={QUANTUM_COLORS.brass} roughness={0.4} />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[-0.64, 1.02, 0]}
      >
        <span>{parts.heater}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[0.64, 1.06, 0]}
      >
        <span>{parts.thermometer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.12, 0.36]}
      >
        <span>{parts.stirrer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[-0.86, 0.44, 0.22]}
      >
        <span>{parts.insulation}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[0.84, 0.42, 0.22]}
      >
        <span>{parts.sample}</span>
      </ThreeLabel>
    </group>
  );
}

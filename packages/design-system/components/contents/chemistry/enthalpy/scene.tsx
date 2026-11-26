import { useFrame, useThree } from "@react-three/fiber";
import type { EnthalpyReaction } from "@repo/design-system/components/contents/chemistry/enthalpy/model";
import { evaluateCalorimeter } from "@repo/design-system/components/contents/chemistry/enthalpy/model";
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

function EnthalpyCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.35] : [0, 1.32, 2.7]}
      cameraTarget={[0, 0.62, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function CalorimeterEnthalpyScene({
  moles,
  parts,
  reaction,
}: {
  readonly moles: number;
  readonly parts: Readonly<
    Record<"cup" | "heatArrow" | "solution" | "stirrer" | "thermometer", string>
  >;
  readonly reaction: EnthalpyReaction;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const stirrerRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluateCalorimeter(reaction, moles);

  useFrame((_, delta) => {
    if (!playing || stirrerRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 3;
    stirrerRef.current.position.y = 0.62 + Math.sin(phaseRef.current) * 0.08;
  });

  const mercuryH = Math.min(
    0.72,
    Math.max(0.18, 0.42 + reading.tempChangeC * 0.012)
  );
  const thermalColor = reading.exothermic
    ? PROCESS_COLORS.hotRed
    : PROCESS_COLORS.coldBlue;

  return (
    <group>
      <SimulationTicker running={playing} />
      <EnthalpyCamera />
      {/* Insulated polystyrene calorimeter cup */}
      <mesh castShadow position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.42, 0.34, 0.72, 24, 1, true]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.ceramicIvory}
          opacity={0.78}
          roughness={0.7}
          side={2}
          transparent
        />
      </mesh>
      {/* Aqueous solution inside */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.36, 0.32, 0.46, 20]} />
        <meshStandardMaterial
          color={thermalColor}
          opacity={0.55}
          roughness={0.22}
          transparent
        />
      </mesh>
      {/* Thermometer stem and mercury column */}
      <mesh position={[-0.08, 0.76, 0]}>
        <cylinderGeometry args={[0.036, 0.036, 0.96, 12]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.glassClear}
          opacity={0.48}
          transparent
        />
      </mesh>
      <mesh position={[-0.08, 0.28 + mercuryH * 0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, mercuryH, 10]} />
        <meshStandardMaterial color={thermalColor} roughness={0.25} />
      </mesh>
      {/* Reciprocating glass stirrer */}
      <group position={[0.14, 0.62, 0]} ref={stirrerRef}>
        <mesh>
          <cylinderGeometry args={[0.018, 0.018, 0.72, 10]} />
          <meshStandardMaterial color={PROCESS_COLORS.anodeZinc} />
        </mesh>
      </group>
      {/* Heat flow arrow cone */}
      <mesh
        castShadow
        position={[0.64, 0.48, 0]}
        rotation={[0, 0, reading.exothermic ? -Math.PI / 2 : Math.PI / 2]}
      >
        <coneGeometry args={[0.08, 0.24, 12]} />
        <meshStandardMaterial color={thermalColor} roughness={0.35} />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.58, 1.18, 0]}
      >
        <span>{parts.thermometer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.56, 1.04, 0]}
      >
        <span>{parts.stirrer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.68, 0.42, 0]}
      >
        <span>{parts.cup}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.64, 0.18, 0.34]}
      >
        <span>{parts.solution}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.78, 0.32, 0]}
      >
        <span>{parts.heatArrow}</span>
      </ThreeLabel>
    </group>
  );
}

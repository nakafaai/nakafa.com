import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  ColumnLiquid,
  LabBench,
} from "@repo/design-system/components/contents/chemistry/bench";
import {
  CalibratedThermometer,
  CalorimeterVessel,
  ThermalArrow,
  WireRingStirrer,
} from "@repo/design-system/components/contents/chemistry/enthalpy/geometry";
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

const BENCH_Z = 0.04;
const ARROW_BASE_X = 0.104;

function EnthalpyCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.02, 0.27, 0.84] : [0.02, 0.22, 0.65]}
      cameraTarget={[0, 0.148, BENCH_Z]}
      fov={38}
      maxDistance={1.5}
      minDistance={0.28}
    />
  );
}

/**
 * Bench-scale double-walled laboratory calorimeter with cutaway insulation,
 * reacting aqueous solution, calibrated glass thermometer, reciprocating
 * stainless wire ring stirrer, and glowing 3D thermal flow arrows.
 */
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
  const labelInk = useLabelInk();
  const stirrerRef = useRef<Group>(null);
  const leftArrowRef = useRef<Group>(null);
  const rightArrowRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const reading = evaluateCalorimeter(reaction, moles);
  const thermalColor = reading.exothermic
    ? PROCESS_COLORS.hotRed
    : PROCESS_COLORS.coldBlue;
  const solutionColor = reading.exothermic
    ? PROCESS_COLORS.weakAcidOrange
    : PROCESS_COLORS.silicaBlue;

  // Map reaction heat magnitude and moles to liquid level, column height, and arrow power
  const heatMagnitude = Math.abs(reading.deltaHKjPerMol * moles);
  const heatPower = Math.min(1, Math.log10(1 + heatMagnitude * 0.25) / 1.3);
  const arrowScale = 0.72 + heatPower * 0.62;
  const arrowGlow = 0.26 + heatPower * 0.68;
  const liquidLevel = Math.min(0.114, 0.084 + Math.max(0, moles) * 0.14);
  const columnTopY = Math.min(
    0.256,
    Math.max(0.142, 0.194 + Math.tanh(reading.tempChangeC / 24) * 0.058)
  );

  useFrame((_, delta) => {
    if (!playing) {
      if (stirrerRef.current !== null) {
        stirrerRef.current.position.y = 0;
      }
      if (leftArrowRef.current !== null) {
        leftArrowRef.current.position.x = -ARROW_BASE_X;
      }
      if (rightArrowRef.current !== null) {
        rightArrowRef.current.position.x = ARROW_BASE_X;
      }
      return;
    }
    phaseRef.current += simulationStep(delta) * 3.4;
    if (stirrerRef.current !== null) {
      stirrerRef.current.position.y = Math.sin(phaseRef.current) * 0.015;
    }
    const direction = reading.exothermic ? 1 : -1;
    const pulse =
      (0.5 + 0.5 * Math.sin(phaseRef.current * 0.9)) * 0.014 * direction;
    if (leftArrowRef.current !== null) {
      leftArrowRef.current.position.x = -ARROW_BASE_X - pulse;
    }
    if (rightArrowRef.current !== null) {
      rightArrowRef.current.position.x = ARROW_BASE_X + pulse;
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <EnthalpyCamera />
      <LabBench width={2.4} />
      {/* Benchtop insulated calorimeter assembly */}
      <group position={[0, 0, BENCH_Z]}>
        <CalorimeterVessel />
        {/* Reacting aqueous solution visible through the cutaway window */}
        <ColumnLiquid
          bottom={0.019}
          color={solutionColor}
          level={liquidLevel}
          opacity={0.72}
          radius={0.0472}
        />
        {/* Subtle thermal shimmer glow across meniscus surface */}
        <mesh
          position={[0, liquidLevel + 0.001, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.045, 32]} />
          <meshStandardMaterial
            color={thermalColor}
            emissive={thermalColor}
            emissiveIntensity={0.22 + heatPower * 0.45}
            opacity={0.28}
            roughness={0.2}
            transparent
          />
        </mesh>
        {/* Calibrated glass thermometer through left brass lid grommet */}
        <group position={[-0.02, 0.028, 0.006]}>
          <CalibratedThermometer
            columnColor={thermalColor}
            columnTopY={columnTopY}
          />
        </group>
        {/* Reciprocating stainless wire ring stirrer through right brass grommet */}
        <group ref={stirrerRef}>
          <WireRingStirrer />
        </group>
        {/* Sculpted 3D heat-transfer arrows: outward for exo, inward for endo */}
        <group position={[-ARROW_BASE_X, 0.082, 0]} ref={leftArrowRef}>
          <ThermalArrow
            color={thermalColor}
            emissiveIntensity={arrowGlow}
            pointing={reading.exothermic ? "left" : "right"}
            scale={arrowScale}
          />
        </group>
        <group position={[ARROW_BASE_X, 0.082, 0]} ref={rightArrowRef}>
          <ThermalArrow
            color={thermalColor}
            emissiveIntensity={arrowGlow}
            pointing={reading.exothermic ? "right" : "left"}
            scale={arrowScale}
          />
        </group>
      </group>
      {/* Adaptive theme-aware labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.12, 0.268, BENCH_Z + 0.01]}
      >
        <span>{parts.thermometer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.12, 0.262, BENCH_Z + 0.01]}
      >
        <span>{parts.stirrer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.148, 0.145, BENCH_Z + 0.02]}
      >
        <span>{parts.cup}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0, 0.032, BENCH_Z + 0.088]}
      >
        <span>{parts.solution}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.16, 0.135, BENCH_Z + 0.01]}
      >
        <span>{parts.heatArrow}</span>
      </ThreeLabel>
    </group>
  );
}

import { useFrame, useThree } from "@react-three/fiber";
import type {
  IndicatorKind,
  PhSample,
} from "@repo/design-system/components/contents/chemistry/indicator/model";
import { evaluatePhIndicator } from "@repo/design-system/components/contents/chemistry/indicator/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr, Match } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function IndicatorCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.35] : [0, 1.32, 2.7]}
      cameraTarget={[0, 0.6, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

function toneHex(
  tone:
    | "blue"
    | "clear"
    | "green"
    | "orange"
    | "pink"
    | "purple"
    | "red"
    | "teal"
    | "yellow"
): string {
  return Match.value(tone).pipe(
    Match.when("red", () => PROCESS_COLORS.acidRed),
    Match.when("orange", () => PROCESS_COLORS.weakAcidOrange),
    Match.when("green", () => PROCESS_COLORS.neutralGreen),
    Match.when("teal", () => PROCESS_COLORS.weakBaseTeal),
    Match.when("blue", () => PROCESS_COLORS.alkaliBlue),
    Match.when("purple", () => PROCESS_COLORS.alkaliPurple),
    Match.when("pink", () => PROCESS_COLORS.phenolPink),
    Match.when("clear", () => PROCESS_COLORS.glassClear),
    Match.when("yellow", () => PROCESS_COLORS.electronGold),
    Match.exhaustive
  );
}

export function PhIndicatorScene({
  indicator,
  parts,
  sample,
}: {
  readonly indicator: IndicatorKind;
  readonly parts: Readonly<
    Record<"beaker" | "dropper" | "ionCloud" | "phStrip" | "solution", string>
  >;
  readonly sample: PhSample;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const dropRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluatePhIndicator(sample, indicator);
  const liquidColor = toneHex(reading.colorTone);

  const ions = useMemo(
    () =>
      Arr.makeBy(8, (index) => ({
        id: `ion-${index}`,
        isProton: index < Math.round(reading.hPlusRatio * 8),
        x: -0.22 + (index % 4) * 0.14,
        y: 0.24 + Math.floor(index / 4) * 0.2,
      })),
    [reading.hPlusRatio]
  );

  useFrame((_, delta) => {
    if (!playing || dropRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.4;
    const t = phaseRef.current % 1;
    dropRef.current.position.set(0, 1.02 - t * 0.56, 0);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <IndicatorCamera />
      {/* Glass beaker */}
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.42, 0.4, 0.78, 24, 1, true]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.glassClear}
          opacity={0.32}
          roughness={0.18}
          side={2}
          transparent
        />
      </mesh>
      {/* Coloured indicator solution */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.38, 0.37, 0.52, 24]} />
        <meshStandardMaterial
          color={liquidColor}
          opacity={reading.colorTone === "clear" ? 0.28 : 0.78}
          roughness={0.22}
          transparent
        />
      </mesh>
      {/* H+ / OH- ion spheres inside solution */}
      {Arr.map(ions, (ion) => (
        <mesh key={ion.id} position={[ion.x, ion.y, 0.18]}>
          <sphereGeometry args={[0.036, 10, 10]} />
          <meshStandardMaterial
            color={
              ion.isProton ? PROCESS_COLORS.acidRed : PROCESS_COLORS.alkaliBlue
            }
            roughness={0.3}
          />
        </mesh>
      ))}
      {/* Dropper pipette above beaker */}
      <mesh castShadow position={[0, 1.18, 0]}>
        <cylinderGeometry args={[0.04, 0.018, 0.34, 12]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.glassClear}
          roughness={0.2}
        />
      </mesh>
      <group position={[0, 0.88, 0]} ref={dropRef}>
        <mesh>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshStandardMaterial color={liquidColor} roughness={0.2} />
        </mesh>
      </group>
      {/* Dipped pH indicator paper strip */}
      <mesh castShadow position={[0.24, 0.62, 0.08]} rotation={[0, 0, -0.22]}>
        <boxGeometry args={[0.08, 0.58, 0.02]} />
        <meshStandardMaterial color={liquidColor} roughness={0.55} />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.56, 1.18, 0]}
      >
        <span>{parts.dropper}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.68, 0.78, 0]}
      >
        <span>{parts.phStrip}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.74, 0.62, 0]}
      >
        <span>{parts.beaker}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.72, 0.3, 0]}
      >
        <span>{parts.solution}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.72, 0.28, 0]}
      >
        <span>{parts.ionCloud}</span>
      </ThreeLabel>
    </group>
  );
}

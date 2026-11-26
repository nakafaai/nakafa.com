import { useFrame, useThree } from "@react-three/fiber";
import type { HalogenPair } from "@repo/design-system/components/contents/chemistry/halogen/model";
import { evaluateHalogenDisplacement } from "@repo/design-system/components/contents/chemistry/halogen/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Match } from "effect";
import { useRef } from "react";
import type { Group } from "three";

function HalogenCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.5, 3.3] : [0, 1.28, 2.65]}
      cameraTarget={[0, 0.62, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

function layerHex(tone: "amber" | "clear" | "pale" | "violet"): string {
  return Match.value(tone).pipe(
    Match.when("amber", () => PROCESS_COLORS.bromineAmber),
    Match.when("violet", () => PROCESS_COLORS.iodineViolet),
    Match.when("pale", () => PROCESS_COLORS.electronGold),
    Match.when("clear", () => PROCESS_COLORS.glassClear),
    Match.exhaustive
  );
}

export function HalogenDisplacementScene({
  pair,
  parts,
}: {
  readonly pair: HalogenPair;
  readonly parts: Readonly<
    Record<
      | "aqueousLayer"
      | "halideIon"
      | "halogenDrop"
      | "organicLayer"
      | "testTube",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const dropRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const outcome = evaluateHalogenDisplacement(pair);

  useFrame((_, delta) => {
    if (!playing || dropRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.4;
    const t = phaseRef.current % 1;
    dropRef.current.position.set(0, 1.12 - t * 0.48, 0);
  });

  const dropColor = Match.value(pair).pipe(
    Match.when("cl2WithKbr", () => PROCESS_COLORS.chlorineGreen),
    Match.when("cl2WithKi", () => PROCESS_COLORS.chlorineGreen),
    Match.when("br2WithKi", () => PROCESS_COLORS.bromineAmber),
    Match.when("i2WithKcl", () => PROCESS_COLORS.iodineViolet),
    Match.exhaustive
  );

  return (
    <group>
      <SimulationTicker running={playing} />
      <HalogenCamera />
      {/* Glass test tube */}
      <mesh position={[0, 0.56, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 1.04, 22, 1, true]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.glassClear}
          opacity={0.34}
          side={2}
          transparent
        />
      </mesh>
      {/* Lower aqueous halide layer */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.44, 20]} />
        <meshStandardMaterial
          color={layerHex(outcome.aqueousTone)}
          opacity={0.58}
          transparent
        />
      </mesh>
      {/* Upper organic cyclohexane layer showing extracted halogen colour */}
      <mesh position={[0, 0.64, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.22, 20]} />
        <meshStandardMaterial
          color={layerHex(outcome.organicTone)}
          opacity={0.86}
          transparent
        />
      </mesh>
      {/* Falling halogen water drop */}
      <group position={[0, 0.96, 0]} ref={dropRef}>
        <mesh>
          <sphereGeometry args={[0.05, 12, 10]} />
          <meshStandardMaterial color={dropColor} />
        </mesh>
      </group>
      {/* Halide ion bead inside aqueous layer */}
      <mesh position={[-0.08, 0.28, 0.08]}>
        <sphereGeometry args={[0.048, 12, 10]} />
        <meshStandardMaterial
          color={
            outcome.displaced
              ? PROCESS_COLORS.greenProduct
              : PROCESS_COLORS.wasteSlate
          }
        />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.66, 1.06, 0]}
      >
        <span>{parts.halogenDrop}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.72, 0.88, 0]}
      >
        <span>{parts.testTube}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.72, 0.64, 0]}
      >
        <span>{parts.organicLayer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.72, 0.32, 0]}
      >
        <span>{parts.aqueousLayer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.68, 0.22, 0]}
      >
        <span>{parts.halideIon}</span>
      </ThreeLabel>
    </group>
  );
}

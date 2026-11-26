import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  ClampedPipette,
  createTeardropGeometry,
  TestTubeRack,
} from "@repo/design-system/components/contents/chemistry/halogen/geometry";
import type { HalogenPair } from "@repo/design-system/components/contents/chemistry/halogen/model";
import { evaluateHalogenDisplacement } from "@repo/design-system/components/contents/chemistry/halogen/model";
import {
  DROP_START_Y,
  HALIDE_IONS,
  HALOGEN_PAIRS,
  ORGANIC_TOP_Y,
  resetHalogenPairs,
  stepDroplet,
  stepHalideIons,
  stepHalogenPairs,
  TwoLayerTestTube,
} from "@repo/design-system/components/contents/chemistry/halogen/parts";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group, Mesh } from "three";

function HalogenCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 0.28, 0.78] : [0, 0.24, 0.62]}
      cameraTarget={[0, 0.165, 0]}
      fov={37}
      maxDistance={1.5}
      minDistance={0.3}
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

function dropHex(pair: HalogenPair): string {
  return Match.value(pair).pipe(
    Match.when("cl2WithKbr", () => PROCESS_COLORS.chlorineGreen),
    Match.when("cl2WithKi", () => PROCESS_COLORS.chlorineGreen),
    Match.when("br2WithKi", () => PROCESS_COLORS.bromineAmber),
    Match.when("i2WithKcl", () => PROCESS_COLORS.iodineViolet),
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
  const invalidate = useThree((state) => state.invalidate);
  const labelInk = useLabelInk();
  const dropRef = useRef<Mesh>(null);
  const rippleRef = useRef<Mesh>(null);
  const pairsRef = useRef<Group>(null);
  const ionsRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const outcome = evaluateHalogenDisplacement(pair);
  const dropColor = dropHex(pair);
  const organicHex = layerHex(outcome.organicTone);
  const aqueousHex = layerHex(outcome.aqueousTone);

  const teardropGeo = useMemo(createTeardropGeometry, []);
  useEffect(() => () => teardropGeo.dispose(), [teardropGeo]);

  useVisualStop(() => {
    phaseRef.current = 0;
    if (dropRef.current !== null) {
      dropRef.current.position.set(0, DROP_START_Y, 0);
      dropRef.current.scale.set(1, 1, 1);
    }
    if (rippleRef.current !== null) {
      rippleRef.current.scale.set(0.01, 0.01, 0.01);
      rippleRef.current.visible = false;
    }
    resetHalogenPairs(pairsRef.current, outcome.displaced);
    if (ionsRef.current !== null) {
      for (let i = 0; i < ionsRef.current.children.length; i += 1) {
        const child = ionsRef.current.children[i];
        const ion = HALIDE_IONS[i];
        if (child !== undefined && ion !== undefined) {
          child.position.set(ion.x, ion.y, ion.z);
        }
      }
    }
    invalidate();
  });

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.92;
    const phase = phaseRef.current;
    stepDroplet(dropRef.current, rippleRef.current, phase % 1);
    stepHalogenPairs(pairsRef.current, phase, outcome.displaced);
    stepHalideIons(ionsRef.current, phase);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <HalogenCamera />
      <LabBench width={2.6} />

      <TestTubeRack />
      <ClampedPipette dropColor={dropColor} />

      <TwoLayerTestTube aqueousHex={aqueousHex} organicHex={organicHex}>
        {/* Halide ions (X-) in lower aqueous layer */}
        <group ref={ionsRef}>
          {Arr.map(HALIDE_IONS, (ion) => (
            <mesh key={ion.id} position={[ion.x, ion.y, ion.z]}>
              <sphereGeometry args={[0.0038, 12, 10]} />
              <meshStandardMaterial
                color={
                  outcome.displaced
                    ? PROCESS_COLORS.greenProduct
                    : PROCESS_COLORS.wasteSlate
                }
                emissive={
                  outcome.displaced
                    ? PROCESS_COLORS.greenProduct
                    : PROCESS_COLORS.wasteSlate
                }
                emissiveIntensity={outcome.displaced ? 0.42 : 0.14}
                roughness={0.25}
              />
            </mesh>
          ))}
        </group>

        {/* Displaced diatomic halogen molecules (X2) rising into organic layer */}
        <group ref={pairsRef}>
          {Arr.map(HALOGEN_PAIRS, (spec) => (
            <group
              key={spec.id}
              position={[
                spec.x,
                outcome.displaced ? 0.072 + spec.offset * 0.072 : 0.132,
                spec.z,
              ]}
            >
              <mesh position={[-0.0028, 0, 0]}>
                <sphereGeometry args={[0.0034, 12, 10]} />
                <meshStandardMaterial
                  color={organicHex}
                  emissive={organicHex}
                  emissiveIntensity={0.45}
                  roughness={0.2}
                />
              </mesh>
              <mesh position={[0.0028, 0, 0]}>
                <sphereGeometry args={[0.0034, 12, 10]} />
                <meshStandardMaterial
                  color={organicHex}
                  emissive={organicHex}
                  emissiveIntensity={0.45}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
        </group>

        {/* Falling halogen water teardrop and organic surface splash ripple */}
        <mesh
          geometry={teardropGeo}
          position={[0, DROP_START_Y, 0]}
          ref={dropRef}
        >
          <meshPhysicalMaterial
            clearcoat={0.9}
            color={dropColor}
            emissive={dropColor}
            emissiveIntensity={0.22}
            roughness={0.12}
          />
        </mesh>
        <mesh
          position={[0, ORGANIC_TOP_Y + 0.001, 0]}
          ref={rippleRef}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[0.01, 0.01, 0.01]}
          visible={false}
        >
          <torusGeometry args={[0.011, 0.0009, 8, 28]} />
          <GlassMaterial color={BENCH_COLORS.streamGlint} opacity={0.72} />
        </mesh>
      </TwoLayerTestTube>

      {/* Well-separated adaptive-ink labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.132, 0.268, 0.01]}
      >
        <span>{parts.halogenDrop}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.135, 0.195, 0.02]}
      >
        <span>{parts.testTube}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.145, 0.142, 0.01]}
      >
        <span>{parts.organicLayer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.148, 0.072, 0.02]}
      >
        <span>{parts.aqueousLayer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.145, 0.052, 0.01]}
      >
        <span>{parts.halideIon}</span>
      </ThreeLabel>
    </group>
  );
}

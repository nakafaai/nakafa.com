import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  ChloroplastReading,
  ChloroplastStage,
} from "@repo/design-system/components/contents/biology/chloroplast/model";
import {
  ChloroplastEnvelope,
  ChloroplastInterior,
} from "@repo/design-system/components/contents/biology/chloroplast/organelles";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr } from "effect";
import { useCallback, useRef } from "react";
import type { Group } from "three";
import { DoubleSide } from "three";

const PHOTON_BEAMS = [-0.58, -0.24, 0.12] as const;

function ChloroplastCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.45, 2.05, 3.65] : [0.35, 1.72, 3.15]}
      cameraTarget={[0, 0.48, 0]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.3}
    />
  );
}

export function ChloroplastScene({
  parts,
  reading,
  stage,
}: {
  readonly parts: Readonly<
    Record<
      | "atp"
      | "co2"
      | "glucose"
      | "granum"
      | "nadph"
      | "oxygen"
      | "stroma"
      | "thylakoid"
      | "water",
      string
    >
  >;
  readonly reading: ChloroplastReading;
  readonly stage: ChloroplastStage;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const shuttlesRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const rewind = useCallback(() => {
    phaseRef.current = 0;
    if (shuttlesRef.current !== null) {
      shuttlesRef.current.position.set(0, 0, 0);
    }
  }, []);
  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing || shuttlesRef.current === null) {
      return;
    }
    const speed = 0.8 + reading.photosynthesisRate * 2.2;
    phaseRef.current += simulationStep(delta) * speed;
    shuttlesRef.current.position.x = Math.sin(phaseRef.current) * 0.16;
    shuttlesRef.current.position.y = Math.cos(phaseRef.current * 1.4) * 0.045;
  });

  const granaActive = stage !== "calvinCycle";
  const stromaActive = stage !== "lightDependent";

  return (
    <group>
      <SimulationTicker running={playing} />
      <ChloroplastCamera />
      <ChloroplastEnvelope stromaActive={stromaActive} />
      <ChloroplastInterior granaActive={granaActive} />

      {/* Light-harvesting photon flux beams striking the grana stacks */}
      {granaActive
        ? Arr.map(PHOTON_BEAMS, (bx) => (
            <mesh
              key={bx}
              position={[bx - 0.12, 0.86, -0.08]}
              rotation={[0, 0, -0.28]}
            >
              <cylinderGeometry args={[0.045, 0.095, 0.68, 18, 1, true]} />
              <meshBasicMaterial
                color={FOLIAGE_COLORS.photonGold}
                depthWrite={false}
                opacity={0.14 + reading.photosynthesisRate * 0.14}
                side={DoubleSide}
                transparent
              />
            </mesh>
          ))
        : null}

      {/* Animated energy and metabolite shuttles */}
      <group ref={shuttlesRef}>
        {/* Water molecule entering thylakoid */}
        <group position={[-0.94, 0.62, 0.24]}>
          <mesh>
            <sphereGeometry args={[0.042, 16, 12]} />
            <meshPhysicalMaterial
              clearcoat={0.9}
              color={FOLIAGE_COLORS.waterMolecule}
              roughness={0.14}
            />
          </mesh>
          <mesh position={[-0.036, 0.025, 0.015]}>
            <sphereGeometry args={[0.024, 12, 10]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.airSpace}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0.036, 0.025, 0.015]}>
            <sphereGeometry args={[0.024, 12, 10]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.airSpace}
              roughness={0.2}
            />
          </mesh>
        </group>

        {/* Rising diatomic O2 bubble */}
        <group
          position={[-0.58, 0.88 + reading.photosynthesisRate * 0.12, -0.05]}
        >
          <mesh position={[-0.026, 0, 0]}>
            <sphereGeometry args={[0.036, 16, 12]} />
            <meshPhysicalMaterial
              clearcoat={1}
              color={FOLIAGE_COLORS.oxygenBubble}
              opacity={0.85}
              roughness={0.1}
              transparent
            />
          </mesh>
          <mesh position={[0.026, 0, 0]}>
            <sphereGeometry args={[0.036, 16, 12]} />
            <meshPhysicalMaterial
              clearcoat={1}
              color={FOLIAGE_COLORS.oxygenBubble}
              opacity={0.85}
              roughness={0.1}
              transparent
            />
          </mesh>
        </group>

        {/* ATP & NADPH energy carrier complexes */}
        <mesh position={[0.08, 0.68, 0.26]}>
          <icosahedronGeometry args={[0.052, 1]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.atpGlow}
            emissive={FOLIAGE_COLORS.atpGlow}
            emissiveIntensity={0.4}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0.26, 0.62, 0.34]}>
          <icosahedronGeometry args={[0.048, 1]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.nadphGlow}
            emissive={FOLIAGE_COLORS.nadphGlow}
            emissiveIntensity={0.35}
            roughness={0.25}
          />
        </mesh>

        {/* Linear CO2 molecule + hexagonal glucose ring in stroma */}
        <group position={[0.84, 0.68, -0.14]} rotation={[0, 0.4, 0.25]}>
          <mesh>
            <sphereGeometry args={[0.032, 14, 10]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.co2Molecule}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[-0.048, 0, 0]}>
            <sphereGeometry args={[0.026, 12, 10]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.oxygenBubble}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0.048, 0, 0]}>
            <sphereGeometry args={[0.026, 12, 10]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.oxygenBubble}
              roughness={0.28}
            />
          </mesh>
        </group>
        <mesh
          position={[0.78, 0.48, 0.24]}
          rotation={[Math.PI / 2 - 0.3, 0, 0]}
        >
          <torusGeometry args={[0.068, 0.022, 10, 6]} />
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={FOLIAGE_COLORS.glucoseRing}
            roughness={0.3}
          />
        </mesh>
      </group>

      {/* Well-spaced theme-aware labels */}
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[-0.62, 1.12, -0.14]}
      >
        <span>
          {parts.granum} ({parts.thylakoid})
        </span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.68, 0.22, 0.68]}>
        <span>{parts.stroma}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.92, 0.78, 0.28]}>
        <span>
          {parts.water} / {parts.oxygen}
        </span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.16, 0.96, 0.3]}>
        <span>
          {parts.atp} / {parts.nadph}
        </span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.88, 0.78, -0.02]}>
        <span>
          {parts.co2} / {parts.glucose}
        </span>
      </ThreeLabel>
    </group>
  );
}

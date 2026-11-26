import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  archY,
  EnergyAxisFrame,
  EnthalpyGauge,
  energyY,
  MolecularTerraces,
  RAIL_Z_OFFSET,
  RIG_Z,
  trackX,
} from "@repo/design-system/components/contents/chemistry/catalyst/frame";
import type {
  CatalystState,
  ReactionEnthalpy,
} from "@repo/design-system/components/contents/chemistry/catalyst/model";
import { evaluateCatalyst } from "@repo/design-system/components/contents/chemistry/catalyst/model";
import {
  CatalystSurfacePlate,
  PathwayRails,
} from "@repo/design-system/components/contents/chemistry/catalyst/pathway";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { KINETICS_COLORS } from "@repo/design-system/lib/material/kinetics";
import { useEffect, useRef } from "react";
import type { Group, Mesh } from "three";

const INITIAL_PROGRESS = 0.35;

function CatalystCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.02, 0.35, 1.24] : [0.04, 0.29, 0.96]}
      cameraTarget={[0, 0.22, RIG_Z]}
      fov={38}
      maxDistance={2.2}
      minDistance={0.32}
    />
  );
}

/**
 * Glossy 3-atom colliding activated-complex cluster gliding smoothly along the
 * active reaction pathway with a crest-peaking halo glow.
 */
function ActivatedComplex({
  catalyst,
  peakY,
  playing,
  productY,
  reactantY,
}: {
  readonly catalyst: CatalystState;
  readonly peakY: number;
  readonly playing: boolean;
  readonly productY: number;
  readonly reactantY: number;
}) {
  const clusterRef = useRef<Group>(null);
  const haloRef = useRef<Mesh>(null);
  const tRef = useRef(INITIAL_PROGRESS);

  const isPresent = catalyst === "present";
  const activeZ = isPresent ? RIG_Z + RAIL_Z_OFFSET : RIG_Z - RAIL_Z_OFFSET;

  useEffect(() => {
    const cluster = clusterRef.current;
    if (cluster === null) {
      return;
    }
    const t = tRef.current;
    cluster.position.set(
      trackX(t),
      archY(t, reactantY, peakY, productY),
      activeZ
    );
  }, [activeZ, peakY, productY, reactantY]);

  useFrame((_, delta) => {
    const cluster = clusterRef.current;
    if (cluster === null) {
      return;
    }
    if (playing) {
      const rate = isPresent ? 0.42 : 0.22;
      tRef.current = (tRef.current + simulationStep(delta) * rate) % 1;
    }
    const t = tRef.current;
    cluster.position.set(
      trackX(t),
      archY(t, reactantY, peakY, productY),
      activeZ
    );
    cluster.rotation.y = t * Math.PI * 2;

    if (haloRef.current !== null) {
      const crest = Math.sin(Math.PI * t) ** 2;
      const scale = 0.85 + crest * 0.55;
      haloRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group ref={clusterRef}>
      {/* Central high-energy transition-state atom */}
      <mesh castShadow>
        <sphereGeometry args={[0.013, 18, 16]} />
        <meshPhysicalMaterial
          clearcoat={0.9}
          color={KINETICS_COLORS.activationLine}
          emissive={KINETICS_COLORS.activationLine}
          emissiveIntensity={0.5}
          roughness={0.18}
        />
      </mesh>
      {/* Flanking colliding atoms */}
      <mesh castShadow position={[-0.016, -0.004, 0.005]}>
        <sphereGeometry args={[0.0085, 14, 12]} />
        <meshPhysicalMaterial
          clearcoat={0.85}
          color={KINETICS_COLORS.reactant}
          roughness={0.2}
        />
      </mesh>
      <mesh castShadow position={[0.016, 0.004, -0.005]}>
        <sphereGeometry args={[0.0085, 14, 12]} />
        <meshPhysicalMaterial
          clearcoat={0.85}
          color={KINETICS_COLORS.product}
          roughness={0.2}
        />
      </mesh>
      {/* Stretched partial transition bonds */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0024, 0.0024, 0.032, 10]} />
        <meshStandardMaterial color={CAR_COLORS.chrome} roughness={0.25} />
      </mesh>
      {/* Crest-peaking energy halo */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.025, 16, 14]} />
        <meshStandardMaterial
          color={
            isPresent
              ? KINETICS_COLORS.catalysedPath
              : KINETICS_COLORS.activationLine
          }
          depthWrite={false}
          emissive={
            isPresent
              ? KINETICS_COLORS.catalysedPath
              : KINETICS_COLORS.activationLine
          }
          emissiveIntensity={0.65}
          opacity={0.24}
          roughness={0.2}
          transparent
        />
      </mesh>
    </group>
  );
}

export function CatalystPathwayScene({
  catalyst,
  parts,
  reaction,
}: {
  readonly catalyst: CatalystState;
  readonly parts: Readonly<
    Record<
      | "catalysedPeak"
      | "catalystSurface"
      | "productLevel"
      | "reactantLevel"
      | "uncatalysedPeak",
      string
    >
  >;
  readonly reaction: ReactionEnthalpy;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const labelInk = useLabelInk();
  const profile = evaluateCatalyst(reaction, catalyst);

  const reactantY = energyY(profile.reactantHeight);
  const productY = energyY(profile.productHeight);
  const uncatalysedPeakY = energyY(profile.uncatalysedPeakHeight);
  const catalysedPeakY = energyY(profile.catalysedPeakHeight);
  const activePeakY =
    catalyst === "present" ? catalysedPeakY : uncatalysedPeakY;

  return (
    <group>
      <SimulationTicker running={playing} />
      <CatalystCamera />
      <LabBench width={2.6} />
      <EnergyAxisFrame />
      <EnthalpyGauge
        isExothermic={profile.enthalpyChangeKj < 0}
        productY={productY}
        reactantY={reactantY}
      />
      <MolecularTerraces productY={productY} reactantY={reactantY} />
      <PathwayRails
        catalysedPeakY={catalysedPeakY}
        catalyst={catalyst}
        productY={productY}
        reactantY={reactantY}
        uncatalysedPeakY={uncatalysedPeakY}
      />
      <CatalystSurfacePlate catalyst={catalyst} />
      <ActivatedComplex
        catalyst={catalyst}
        peakY={activePeakY}
        playing={playing}
        productY={productY}
        reactantY={reactantY}
      />

      {/* Scene labels using adaptive theme ink */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.23, reactantY + 0.056, RIG_Z]}
      >
        <span>{parts.reactantLevel}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.23, productY + 0.056, RIG_Z]}
      >
        <span>{parts.productLevel}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0, uncatalysedPeakY + 0.036, RIG_Z - RAIL_Z_OFFSET]}
      >
        <span>{parts.uncatalysedPeak}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0, catalysedPeakY - 0.038, RIG_Z + RAIL_Z_OFFSET + 0.03]}
      >
        <span>{parts.catalysedPeak}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0, 0.062, RIG_Z + 0.135]}
      >
        <span>{parts.catalystSurface}</span>
      </ThreeLabel>
    </group>
  );
}

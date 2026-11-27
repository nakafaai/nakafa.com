import { useFrame, useThree } from "@react-three/fiber";
import {
  PhospholipidBilayer,
  WaterMolecules,
} from "@repo/design-system/components/contents/biology/bilayer";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  NucleotideComplex,
  TransmembraneChannel,
} from "@repo/design-system/components/contents/biology/membrane";
import type { TransportMode } from "@repo/design-system/components/contents/biology/pump/model";
import { SpecimenPedestal } from "@repo/design-system/components/contents/biology/workbench";
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
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { Array as Arr, Match } from "effect";
import type { RefObject } from "react";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

const PUMP_CUTOUTS = [
  { radius: 0.26, x: 0, z: 0 },
  { radius: 0.28, x: 0.72, z: 0 },
] as const;

const WATER_POINTS: readonly (readonly [number, number, number])[] = [
  [-1.02, 1.06, 0.16],
  [-0.36, 1.12, -0.14],
  [0.36, 1.1, 0.18],
  [1.06, 1.04, -0.1],
  [-0.92, 0.18, 0.16],
  [-0.28, 0.16, -0.14],
  [0.24, 0.18, 0.22],
];

const HYDRATION_OFFSETS: readonly (readonly [number, number, number])[] = [
  [0.072, 0.032, 0],
  [-0.072, -0.028, 0.02],
  [0.015, -0.068, -0.03],
  [-0.02, 0.068, 0.03],
];

function PumpCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.72, 3.9] : [0, 1.42, 3.36]}
      cameraTarget={[0.04, 0.62, 0]}
      fov={38}
      maxDistance={6.4}
      minDistance={1.4}
    />
  );
}

/**
 * Conformational Na+/K+-ATPase transmembrane carrier pump composed of two
 * sculpted alpha-helical lobes that rock between E1 (cytoplasm-open) and
 * E2 (extracellular-open) states during ATP hydrolysis.
 */
function ConformationalCarrierPump({
  active,
  leftLobeRef,
  rightLobeRef,
}: {
  readonly active: boolean;
  readonly leftLobeRef: RefObject<Group | null>;
  readonly rightLobeRef: RefObject<Group | null>;
}) {
  const lobeGeo = useMemo(() => {
    const curve = new CatmullRomCurve3([
      new Vector3(0, -0.29, 0),
      new Vector3(-0.07, -0.14, 0.03),
      new Vector3(-0.095, 0, -0.02),
      new Vector3(-0.07, 0.14, 0.03),
      new Vector3(0, 0.29, 0),
    ]);
    return new TubeGeometry(curve, 32, 0.072, 16, false);
  }, []);

  useEffect(() => () => lobeGeo.dispose(), [lobeGeo]);

  const opacity = active ? 1 : 0.46;
  const transparent = opacity < 0.99;

  return (
    <group position={[0.72, 0.62, 0]}>
      <group position={[-0.04, 0, 0]} ref={leftLobeRef} rotation={[0, 0, 0.14]}>
        <mesh castShadow geometry={lobeGeo} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.68}
            clearcoatRoughness={0.22}
            color={HOMEOSTASIS_COLORS.pumpSubunitA}
            opacity={opacity}
            roughness={0.32}
            transparent={transparent}
          />
        </mesh>
        {/* Cytoplasmic phosphorylation actuator domain */}
        <mesh castShadow position={[-0.08, -0.24, 0.04]}>
          <sphereGeometry args={[0.068, 18, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.64}
            color={HOMEOSTASIS_COLORS.pumpSubunitB}
            opacity={opacity}
            roughness={0.34}
            transparent={transparent}
          />
        </mesh>
      </group>

      <group
        position={[0.04, 0, 0]}
        ref={rightLobeRef}
        rotation={[0, Math.PI, 0.14]}
      >
        <mesh castShadow geometry={lobeGeo} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.68}
            clearcoatRoughness={0.22}
            color={HOMEOSTASIS_COLORS.pumpSubunitB}
            opacity={opacity}
            roughness={0.32}
            transparent={transparent}
          />
        </mesh>
        <mesh castShadow position={[-0.08, -0.24, -0.04]}>
          <sphereGeometry args={[0.064, 18, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.64}
            color={HOMEOSTASIS_COLORS.pumpSubunitA}
            opacity={opacity}
            roughness={0.34}
            transparent={transparent}
          />
        </mesh>
      </group>

      {/* Ion binding pocket core */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.062, 16, 14]} />
        <meshPhysicalMaterial
          color={HOMEOSTASIS_COLORS.pumpPocket}
          emissive={HOMEOSTASIS_COLORS.pumpSubunitB}
          emissiveIntensity={active ? 0.32 : 0}
          opacity={active ? 0.5 : 0.2}
          roughness={0.25}
          transparent
        />
      </mesh>
    </group>
  );
}

/** Glossy hydrated Na+/K+ ion sphere surrounded by a translucent aqueous hydration shell. */
function HydratedSoluteIon({
  color,
  position = [0, 0, 0],
}: {
  readonly color: string;
  readonly position?: readonly [number, number, number];
}) {
  return (
    <group position={position}>
      <mesh castShadow>
        <sphereGeometry args={[0.056, 22, 18]} />
        <meshPhysicalMaterial
          clearcoat={0.88}
          clearcoatRoughness={0.12}
          color={color}
          emissive={color}
          emissiveIntensity={0.22}
          roughness={0.18}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.084, 18, 14]} />
        <meshPhysicalMaterial
          clearcoat={0.9}
          color={HOMEOSTASIS_COLORS.hydrationHalo}
          opacity={0.28}
          roughness={0.12}
          transparent
        />
      </mesh>
      {Arr.map(HYDRATION_OFFSETS, (pos) => (
        <mesh key={`hy-${pos[0]}-${pos[1]}-${pos[2]}`} position={pos}>
          <sphereGeometry args={[0.015, 10, 8]} />
          <meshPhysicalMaterial
            color={HOMEOSTASIS_COLORS.hydrationHalo}
            opacity={0.7}
            roughness={0.18}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

export function MembranePumpScene({
  mode,
  parts,
}: {
  readonly mode: TransportMode;
  readonly parts: Readonly<
    Record<
      "adp" | "atp" | "bilayer" | "carrierPump" | "channelProtein" | "solute",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const ink = useLabelInk();
  const solutesRef = useRef<Group>(null);
  const leftLobeRef = useRef<Group>(null);
  const rightLobeRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const soluteX = Match.value(mode).pipe(
    Match.when("simpleDiffusion", () => -0.72),
    Match.when("facilitated", () => 0),
    Match.when("activePump", () => 0.72),
    Match.exhaustive
  );
  const initialY = mode === "activePump" ? 0.34 : 0.94;

  const rewind = () => {
    phaseRef.current = 0;
    if (solutesRef.current !== null) {
      solutesRef.current.position.set(soluteX, initialY, 0.14);
    }
    if (leftLobeRef.current !== null) {
      leftLobeRef.current.rotation.z = 0.14;
    }
    if (rightLobeRef.current !== null) {
      rightLobeRef.current.rotation.z = 0.14;
    }
    invalidate();
  };

  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.95;
    const t = phaseRef.current % 1;
    const y = mode === "activePump" ? 0.24 + t * 0.86 : 1.06 - t * 0.84;
    if (solutesRef.current !== null) {
      solutesRef.current.position.set(soluteX, y, 0.14);
    }
    if (
      mode === "activePump" &&
      leftLobeRef.current !== null &&
      rightLobeRef.current !== null
    ) {
      // Smooth E1 inward-open -> E2 outward-open conformational tilt
      const tilt = Math.cos(t * Math.PI * 2) * 0.18;
      leftLobeRef.current.rotation.z = tilt;
      rightLobeRef.current.rotation.z = tilt;
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <PumpCamera />
      <SpecimenPedestal depth={0.96} height={0.055} width={2.58} />

      {/* Shared multi-row phospholipid bilayer cutaway */}
      <PhospholipidBilayer
        cols={12}
        cutouts={PUMP_CUTOUTS}
        rows={3}
        spacingX={0.21}
        spacingZ={0.2}
        yCenter={0.62}
      />

      {/* Sculpted alpha-helical facilitated channel protein (center) */}
      <TransmembraneChannel
        accentColor={HOMEOSTASIS_COLORS.helixBeta}
        color={HOMEOSTASIS_COLORS.helixAlpha}
        height={0.62}
        opacity={mode === "facilitated" ? 1 : 0.45}
        position={[0, 0.62, 0]}
        radius={0.15}
      />

      {/* Conformational ATPase carrier pump (right) */}
      <ConformationalCarrierPump
        active={mode === "activePump"}
        leftLobeRef={leftLobeRef}
        rightLobeRef={rightLobeRef}
      />

      {/* Realistic ATP -> ADP + Pi nucleotide hydrolysis complex */}
      <NucleotideComplex
        mode="atp"
        opacity={mode === "activePump" ? 1 : 0.35}
        position={[0.42, 0.2, 0.28]}
      />
      <NucleotideComplex
        mode="adp"
        opacity={mode === "activePump" ? 1 : 0.35}
        position={[0.88, 0.2, 0.28]}
      />

      {/* Hydrated solute ion crossing according to active mode */}
      <group position={[soluteX, initialY, 0.14]} ref={solutesRef}>
        <HydratedSoluteIon
          color={
            mode === "activePump"
              ? HOMEOSTASIS_COLORS.sodiumIon
              : HOMEOSTASIS_COLORS.potassiumIon
          }
        />
      </group>

      {/* Aqueous surrounding water molecules */}
      <WaterMolecules positions={WATER_POINTS} />

      {/* Adaptive-ink labels */}
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[-0.84, 1.06, 0]}
      >
        <span>{parts.bilayer}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[0, 1.18, 0]}
      >
        <span>
          {parts.channelProtein} / {parts.solute}
        </span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[0.78, 1.1, 0]}
      >
        <span>{parts.carrierPump}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        position={[0.74, 0.1, 0.42]}
      >
        <span>
          {parts.atp} -&gt; {parts.adp}
        </span>
      </ThreeLabel>
    </group>
  );
}

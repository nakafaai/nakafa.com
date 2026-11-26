import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { prepareAnatomicalScene } from "@repo/design-system/components/contents/biology/anatomy";
import { HRA_PLACENTA_ASSET } from "@repo/design-system/components/contents/biology/assets";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { Substance } from "@repo/design-system/components/contents/biology/placenta/exchange";
import {
  particleX,
  transferMode,
} from "@repo/design-system/components/contents/biology/placenta/exchange";
import {
  buildBiconcaveCellGeometry,
  buildHelixTube,
  buildVillusBranch,
} from "@repo/design-system/components/contents/biology/placenta/geometry";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { HEART_COLORS } from "@repo/design-system/lib/material/heart";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo, useRef, useState } from "react";
import { DoubleSide } from "three";

const PARTICLE_OFFSETS = [0, 0.25, 0.5, 0.75] as const;

const PLACENTA_RULES = [
  {
    clearcoat: 0.72,
    clearcoatRoughness: 0.16,
    color: LABORATORY_COLORS.water,
    match: "amnion",
    opacity: 0.34,
    roughness: 0.15,
  },
  {
    clearcoat: 0.6,
    clearcoatRoughness: 0.24,
    color: BIOLOGY_COLORS.blood,
    match: "vessel",
    roughness: 0.32,
  },
  {
    clearcoat: 0.6,
    clearcoatRoughness: 0.24,
    color: HEART_COLORS.veinOuter,
    match: "vein",
    roughness: 0.34,
  },
] as const;

const PLACENTA_FALLBACK = {
  clearcoat: 0.48,
  clearcoatRoughness: 0.3,
  color: BIOLOGY_COLORS.bloodDark,
  roughness: 0.44,
  sheen: 0.4,
  sheenColor: HEART_COLORS.sheen,
} as const;

export type PlacentaPart =
  | "placenta"
  | "cord"
  | "artery"
  | "vein"
  | "villus"
  | "capillary"
  | "maternal"
  | "wall"
  | "amnion"
  | "foetus";

function PlacentaCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.08, 3.45] : [0, 0.9, 2.8]}
      cameraTarget={[0, 0.58, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

function PlacentaOrganSpecimen() {
  const { scene } = useGLTF(HRA_PLACENTA_ASSET.path);
  const specimen = useMemo(
    () =>
      prepareAnatomicalScene(scene, {
        fallback: PLACENTA_FALLBACK,
        rules: PLACENTA_RULES,
        targetExtent: 0.52,
      }),
    [scene]
  );
  return (
    <group position={[0.28, -0.1, 0.02]} rotation={[0.52, -0.95, 0.18]}>
      <primitive object={specimen} />
    </group>
  );
}

/**
 * 3D placental exchange scene: left shows the real NIH Human Reference Atlas
 * full-term placenta joined by a helical 3-vessel umbilical cord to the curled
 * foetus inside the translucent amniotic sac; right magnifies an organic
 * branching chorionic villus separating maternal intervillous blood from the
 * coiled foetal capillary loop.
 */
export function PlacentaScene({
  parts,
  substance,
}: {
  readonly parts: Readonly<Record<PlacentaPart, string>>;
  readonly substance: Substance;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const clock = useRef(0.35);
  const [phase, setPhase] = useState(0.35);

  const cordSheath = useMemo(() => buildHelixTube(0, 0.006, 0.03), []);
  const cordArteryA = useMemo(() => buildHelixTube(0, 0.014, 0.0085), []);
  const cordArteryB = useMemo(() => buildHelixTube(2.1, 0.014, 0.0085), []);
  const cordVein = useMemo(() => buildHelixTube(4.2, 0.012, 0.011), []);

  const villusTrunk = useMemo(
    () =>
      buildVillusBranch(
        [
          [0.02, -0.34, 0],
          [0.0, -0.1, 0.02],
          [-0.02, 0.12, -0.01],
          [0.01, 0.34, 0],
        ],
        0.048
      ),
    []
  );
  const villusFrondA = useMemo(
    () =>
      buildVillusBranch(
        [
          [0, 0.05, 0.01],
          [-0.12, 0.14, 0.06],
          [-0.22, 0.21, 0.02],
        ],
        0.03
      ),
    []
  );
  const villusFrondB = useMemo(
    () =>
      buildVillusBranch(
        [
          [0, -0.12, 0],
          [-0.13, -0.18, -0.05],
          [-0.24, -0.22, 0.02],
        ],
        0.028
      ),
    []
  );
  const foetalCapillary = useMemo(
    () =>
      buildVillusBranch(
        [
          [0.36, -0.28, 0.02],
          [0.2, -0.18, 0.08],
          [0.14, 0, 0.04],
          [0.2, 0.18, -0.04],
          [0.36, 0.28, 0.02],
        ],
        0.042
      ),
    []
  );
  const rbcGeo = useMemo(buildBiconcaveCellGeometry, []);

  useEffect(
    () => () => {
      cordSheath.dispose();
      cordArteryA.dispose();
      cordArteryB.dispose();
      cordVein.dispose();
      villusTrunk.dispose();
      villusFrondA.dispose();
      villusFrondB.dispose();
      foetalCapillary.dispose();
      rbcGeo.dispose();
    },
    [
      cordArteryA,
      cordArteryB,
      cordSheath,
      cordVein,
      foetalCapillary,
      rbcGeo,
      villusFrondA,
      villusFrondB,
      villusTrunk,
    ]
  );

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current = (clock.current + simulationStep(delta) * 0.4) % 1;
    setPhase(clock.current);
  });

  const mode = transferMode(substance);
  const particleColor = Match.value(substance).pipe(
    Match.when("oxygen", () => PLOT_COLORS.teal),
    Match.when("glucose", () => BIOLOGY_COLORS.glucose),
    Match.when("aminoAcids", () => PLOT_COLORS.violet),
    Match.when("antibodies", () => CELL_COLORS.antibody),
    Match.when("carbonDioxide", () => PLOT_COLORS.slate),
    Match.when("urea", () => BIOLOGY_COLORS.urea),
    Match.when("alcohol", () => PLOT_COLORS.orange),
    Match.when("bloodCells", () => BIOLOGY_COLORS.blood),
    Match.exhaustive
  );

  return (
    <group>
      <SimulationTicker running={playing} />
      <PlacentaCamera />

      <group position={[-0.66, 0.58, 0]}>
        <mesh>
          <sphereGeometry args={[0.37, 36, 32]} />
          <meshPhysicalMaterial
            clearcoat={0.9}
            clearcoatRoughness={0.08}
            color={LABORATORY_COLORS.water}
            depthWrite={false}
            ior={1.34}
            opacity={0.22}
            roughness={0.08}
            side={DoubleSide}
            transparent
          />
        </mesh>

        <group position={[-0.1, 0.04, 0]} rotation={[0.08, 0.18, 0.25]}>
          <mesh castShadow position={[0.01, 0.13, 0.03]}>
            <sphereGeometry args={[0.082, 24, 20]} />
            <meshPhysicalMaterial
              clearcoat={0.32}
              color={BIOLOGY_COLORS.tubule}
              roughness={0.48}
            />
          </mesh>
          <mesh
            castShadow
            position={[-0.02, -0.02, 0]}
            rotation={[0, 0, -0.22]}
          >
            <capsuleGeometry args={[0.068, 0.12, 14, 24]} />
            <meshPhysicalMaterial
              clearcoat={0.32}
              color={BIOLOGY_COLORS.tubule}
              roughness={0.48}
            />
          </mesh>
          <mesh
            castShadow
            position={[0.06, -0.08, 0.03]}
            rotation={[0.3, 0, 0.7]}
          >
            <capsuleGeometry args={[0.034, 0.08, 10, 16]} />
            <meshPhysicalMaterial
              clearcoat={0.32}
              color={BIOLOGY_COLORS.tubule}
              roughness={0.48}
            />
          </mesh>
        </group>

        <mesh geometry={cordSheath}>
          <meshPhysicalMaterial
            clearcoat={0.75}
            color={PLOT_COLORS.pink}
            depthWrite={false}
            opacity={0.34}
            roughness={0.18}
            transparent
          />
        </mesh>
        <mesh castShadow geometry={cordArteryA}>
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={BIOLOGY_COLORS.blood}
            roughness={0.34}
          />
        </mesh>
        <mesh castShadow geometry={cordArteryB}>
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={BIOLOGY_COLORS.bloodDark}
            roughness={0.36}
          />
        </mesh>
        <mesh castShadow geometry={cordVein}>
          <meshPhysicalMaterial
            clearcoat={0.55}
            color={HEART_COLORS.veinOuter}
            roughness={0.32}
          />
        </mesh>

        <PlacentaOrganSpecimen />

        <ThreeLabel
          anchorY="bottom"
          color={ink}
          gap={0.04}
          position={[-0.08, 0.44, 0]}
        >
          {parts.foetus}
        </ThreeLabel>
        <ThreeLabel
          anchorY="top"
          color={ink}
          gap={0.04}
          position={[0.26, -0.42, 0]}
        >
          {parts.placenta}
        </ThreeLabel>
      </group>

      <group position={[0.56, 0.58, 0]}>
        <mesh position={[-0.24, 0, -0.03]}>
          <cylinderGeometry args={[0.34, 0.36, 0.68, 32]} />
          <meshPhysicalMaterial
            clearcoat={0.65}
            color={BIOLOGY_COLORS.blood}
            depthWrite={false}
            opacity={0.22}
            roughness={0.18}
            transparent
          />
        </mesh>

        <mesh castShadow geometry={villusTrunk}>
          <meshPhysicalMaterial
            clearcoat={0.48}
            clearcoatRoughness={0.28}
            color={CELL_COLORS.membrane}
            roughness={0.42}
          />
        </mesh>
        <mesh castShadow geometry={villusFrondA}>
          <meshPhysicalMaterial
            clearcoat={0.48}
            color={CELL_COLORS.membrane}
            roughness={0.42}
          />
        </mesh>
        <mesh castShadow geometry={villusFrondB}>
          <meshPhysicalMaterial
            clearcoat={0.48}
            color={CELL_COLORS.membrane}
            roughness={0.42}
          />
        </mesh>

        <mesh castShadow geometry={foetalCapillary}>
          <meshPhysicalMaterial
            clearcoat={0.65}
            color={BIOLOGY_COLORS.bloodDark}
            roughness={0.28}
          />
        </mesh>

        {Arr.map(PARTICLE_OFFSETS, (offset) => {
          const x = particleX(mode, phase + offset);
          const y = -0.22 + offset * 0.56;
          return substance === "bloodCells" ? (
            <mesh
              castShadow
              geometry={rbcGeo}
              key={offset}
              position={[x, y, 0.16]}
              rotation={[0.45, offset * 2, 0.3]}
            >
              <meshPhysicalMaterial
                clearcoat={0.65}
                color={particleColor}
                roughness={0.26}
              />
            </mesh>
          ) : (
            <mesh castShadow key={offset} position={[x, y, 0.16]}>
              <sphereGeometry args={[0.036, 20, 18]} />
              <meshPhysicalMaterial
                clearcoat={0.75}
                color={particleColor}
                roughness={0.2}
              />
            </mesh>
          );
        })}

        <ThreeLabel
          anchorY="bottom"
          color={ink}
          gap={0.04}
          position={[-0.36, 0.45, 0]}
        >
          {parts.maternal}
        </ThreeLabel>
        <ThreeLabel
          anchorY="top"
          color={ink}
          gap={0.04}
          position={[0.02, -0.42, 0.08]}
        >
          {parts.villus}
        </ThreeLabel>
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          gap={0.04}
          position={[0.34, 0.45, 0]}
        >
          {parts.capillary}
        </ThreeLabel>
      </group>
    </group>
  );
}

useGLTF.preload(HRA_PLACENTA_ASSET.path);

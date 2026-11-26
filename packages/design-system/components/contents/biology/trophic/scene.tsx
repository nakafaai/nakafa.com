import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { AnimatedFlightBird } from "@repo/design-system/components/contents/biology/fauna";
import {
  useFoliageMaterial,
  useGrassClump,
  useMossCushion,
  useMushroomCluster,
} from "@repo/design-system/components/contents/biology/flora";
import type { TrophicScenario } from "@repo/design-system/components/contents/biology/trophic/model";
import { evaluateTrophicPyramid } from "@repo/design-system/components/contents/biology/trophic/model";
import {
  TrophicDeerSpecimen,
  TrophicFoxSpecimen,
  useTrophicProps,
} from "@repo/design-system/components/contents/biology/trophic/specimens";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOME_COLORS } from "@repo/design-system/lib/material/biome";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const PRODUCER_OFFSETS = [
  [-0.4, -0.22],
  [-0.14, -0.24],
  [0.14, -0.24],
  [0.4, -0.22],
  [-0.36, 0.16],
  [-0.1, 0.2],
  [0.18, 0.2],
  [0.4, 0.15],
  [0, -0.02],
] as const;

const HERBIVORE_OFFSETS = [
  [-0.3, 0.08, 0.55],
  [0.02, -0.14, -0.3],
  [0.31, 0.1, -0.65],
] as const;

const PREDATOR_OFFSETS = [
  [-0.22, 0.05, 0.45],
  [0.22, -0.04, -0.5],
] as const;

function TrophicCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.64, 1.94, 4.35] : [0.56, 1.62, 3.6]}
      cameraTarget={[0, 0.84, 0]}
      fov={36}
      maxDistance={6.8}
      minDistance={1.6}
    />
  );
}

/** One sculpted botanical specimen terrarium deck (timber base + translucent glass tray rim). */
function TrophicDeck({
  color,
  height,
  width,
  y,
}: {
  readonly color: string;
  readonly height: number;
  readonly width: number;
  readonly y: number;
}) {
  const depth = width * 0.72;
  return (
    <group position={[0, y, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height * 0.36, depth]} />
        <SurfaceMaterial
          bump={0.55}
          color={BIOME_COLORS.quadratWood}
          repeat={[2, 1]}
          roughness={0.68}
          surface="wood"
        />
      </mesh>
      <mesh position={[0, height * 0.42, 0]}>
        <boxGeometry args={[width * 0.96, height * 0.62, depth * 0.96]} />
        <GlassMaterial color={color} opacity={0.26} />
      </mesh>
    </group>
  );
}

export function FoodWebTrophicScene({
  energyInput,
  parts,
  scenario,
}: {
  readonly energyInput: number;
  readonly parts: Readonly<
    Record<
      | "decomposer"
      | "heatLoss"
      | "primaryConsumer"
      | "producer"
      | "secondaryConsumer"
      | "tertiaryConsumer",
      string
    >
  >;
  readonly scenario: TrophicScenario;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const heatRef = useRef<Group>(null);
  const apexRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const state = evaluateTrophicPyramid(scenario, energyInput);

  const grass = useGrassClump(31, 14);
  const moss = useMossCushion(32);
  const mushrooms = useMushroomCluster(33);
  const foliageMat = useFoliageMaterial();
  const { heatRibbonA, heatRibbonB, log } = useTrophicProps();

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 2.1;
    if (heatRef.current !== null) {
      heatRef.current.position.y = 0.48 + Math.sin(phaseRef.current) * 0.08;
    }
    if (apexRef.current !== null) {
      apexRef.current.position.y =
        1.52 + Math.sin(phaseRef.current * 1.4) * 0.045;
    }
  });

  const energyScale = Math.min(
    1.26,
    Math.max(0.72, Math.sqrt(energyInput / 10_000))
  );
  const w0 = Math.min(
    2.25,
    Math.max(0.85, (state.producerKj / 10_000) * 1.45 + 0.48)
  );
  const w1 = Math.min(
    1.62,
    Math.max(0.45, (state.primaryKj / 1000) * 1.02 + 0.3)
  );
  const w2 = Math.min(
    1.12,
    Math.max(0.32, (state.secondaryKj / 100) * 0.68 + 0.22)
  );
  const w3 = state.tertiaryKj > 0 ? Math.max(0.46, 0.52 * energyScale) : 0.26;
  const producerGlass =
    scenario === "algalBloom"
      ? BIOME_COLORS.lichenLime
      : BIOME_COLORS.canopyEmerald;
  const producerFlora = scenario === "algalBloom" ? moss : grass;
  const producerCount =
    scenario === "overharvest" ? 4 : PRODUCER_OFFSETS.length;

  return (
    <group>
      <SimulationTicker running={playing} />
      <TrophicCamera />

      {/* Tier 1: Producers (lush grass / moss flora) */}
      <TrophicDeck color={producerGlass} height={0.28} width={w0} y={0.07} />
      <group position={[0, 0.12, 0]}>
        {Arr.map(Arr.take(PRODUCER_OFFSETS, producerCount), ([ox, oz]) => (
          <mesh
            castShadow
            geometry={producerFlora}
            key={`prod-${ox}-${oz}`}
            material={foliageMat}
            position={[ox * w0, 0, oz * w0 * 0.65]}
            rotation={[0, ox * 5, 0]}
            scale={
              scenario === "algalBloom"
                ? 0.92 * energyScale
                : 0.78 * energyScale
            }
          />
        ))}
      </group>

      {/* Tier 2: Primary consumers (CC0 grazing deer) */}
      <TrophicDeck
        color={BIOME_COLORS.cloverGreen}
        height={0.26}
        width={w1}
        y={0.44}
      />
      <group position={[0, 0.485, 0]}>
        {Arr.map(HERBIVORE_OFFSETS, ([ox, oz, rot]) => (
          <TrophicDeerSpecimen
            key={`deer-${ox}-${oz}`}
            position={[ox * w1, 0, oz * w1 * 0.56]}
            rotationY={rot}
            scale={0.86 * energyScale}
          />
        ))}
      </group>

      {/* Tier 3: Secondary consumers (CC0 foxes) */}
      <TrophicDeck
        color={BIOME_COLORS.heatAmber}
        height={0.24}
        width={w2}
        y={0.9}
      />
      <group position={[0, 0.945, 0]}>
        {Arr.map(PREDATOR_OFFSETS, ([ox, oz, rot]) => (
          <TrophicFoxSpecimen
            key={`fox-${ox}-${oz}`}
            position={[ox * w2, 0, oz * w2 * 0.52]}
            rotationY={rot}
            scale={0.82 * energyScale}
          />
        ))}
      </group>

      {/* Tier 4: Tertiary apex consumer (animated morph-target soaring golden-brown raptor) */}
      <TrophicDeck
        color={BIOME_COLORS.predatorOrange}
        height={0.2}
        width={w3}
        y={1.28}
      />
      <group position={[0, 1.52, 0]} ref={apexRef} rotation={[0.08, -0.52, 0]}>
        <AnimatedFlightBird
          color={BIOME_COLORS.raptorFeather}
          opacity={state.tertiaryKj > 0 ? 1 : 0.24}
          playing={playing}
          poseTime={0.26}
          sheenColor={BIOME_COLORS.raptorGold}
          speed={0.95}
          targetExtent={0.62 * energyScale}
        />
      </group>

      {/* Decomposer nurse log & fruiting mushrooms */}
      <group position={[-1.34, 0, 0.24]}>
        <mesh castShadow geometry={log} receiveShadow>
          <SurfaceMaterial
            bump={0.95}
            color={BIOME_COLORS.barkDark}
            repeat={[2, 1]}
            roughness={0.92}
            surface="bark"
          />
        </mesh>
        <mesh castShadow geometry={mushrooms} position={[0, 0.08, 0]}>
          <meshPhysicalMaterial
            clearcoat={0.25}
            roughness={0.48}
            vertexColors
          />
        </mesh>
      </group>

      {/* Rising respiratory heat-loss plumes */}
      <group position={[1.14, 0.48, 0]} ref={heatRef} scale={energyScale}>
        <mesh geometry={heatRibbonA}>
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={BIOME_COLORS.heatAmber}
            emissive={BIOME_COLORS.heatAmber}
            emissiveIntensity={0.28}
            opacity={0.78}
            roughness={0.22}
            transparent
          />
        </mesh>
        <mesh geometry={heatRibbonB}>
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={BIOME_COLORS.predatorOrange}
            emissive={BIOME_COLORS.predatorOrange}
            emissiveIntensity={0.26}
            opacity={0.72}
            roughness={0.22}
            transparent
          />
        </mesh>
      </group>

      {/* Dynamic light/dark-mode labels */}
      <ThreeLabel color={ink} fontSize="compact" position={[0, 1.88, 0]}>
        <span>{parts.tertiaryConsumer}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.98, 1.14, 0.22]}>
        <span>{parts.secondaryConsumer}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.92, 0.64, 0.45]}>
        <span>{parts.primaryConsumer}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0, 0.24, 0.94]}>
        <span>{parts.producer}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-1.2, 0.48, 0.26]}>
        <span>{parts.decomposer}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[1.24, 1.38, 0]}>
        <span>{parts.heatLoss}</span>
      </ThreeLabel>
    </group>
  );
}

import { useFrame, useThree } from "@react-three/fiber";
import {
  useFoliageMaterial,
  useGrassClump,
  useMossCushion,
  useMushroomCluster,
} from "@repo/design-system/components/contents/biology/flora";
import type { TrophicScenario } from "@repo/design-system/components/contents/biology/trophic/model";
import { evaluateTrophicPyramid } from "@repo/design-system/components/contents/biology/trophic/model";
import { useTrophicSpecimens } from "@repo/design-system/components/contents/biology/trophic/specimens";
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
import { DoubleSide } from "three";

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
  [-0.34, 0.06],
  [-0.11, -0.14],
  [0.14, 0.14],
  [0.34, -0.08],
] as const;

const PREDATOR_OFFSETS = [
  [-0.2, 0.04],
  [0.2, -0.04],
] as const;

function TrophicCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.62, 1.85, 4.15] : [0.52, 1.52, 3.4]}
      cameraTarget={[0, 0.76, 0]}
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
        <GlassMaterial color={color} opacity={0.28} />
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
  const heatRef = useRef<Group>(null);
  const apexRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const state = evaluateTrophicPyramid(scenario, energyInput);

  const grass = useGrassClump(31, 14);
  const moss = useMossCushion(32);
  const mushrooms = useMushroomCluster(33);
  const foliageMat = useFoliageMaterial();
  const { apex, heatRibbonA, heatRibbonB, herbivore, log, secondary } =
    useTrophicSpecimens();

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
        1.26 + Math.sin(phaseRef.current * 1.4) * 0.04;
    }
  });

  const energyScale = Math.min(
    1.3,
    Math.max(0.68, Math.sqrt(energyInput / 10_000))
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
  const w3 = state.tertiaryKj > 0 ? Math.max(0.42, 0.5 * energyScale) : 0.24;
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

      <TrophicDeck color={producerGlass} height={0.28} width={w0} y={0.07} />
      <group position={[0, 0.11, 0]}>
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

      <TrophicDeck
        color={BIOME_COLORS.cloverGreen}
        height={0.26}
        width={w1}
        y={0.44}
      />
      <group position={[0, 0.48, 0]}>
        {Arr.map(HERBIVORE_OFFSETS, ([ox, oz]) => (
          <mesh
            castShadow
            geometry={herbivore}
            key={`herb-${ox}-${oz}`}
            position={[ox * w1, 0, oz * w1 * 0.62]}
            rotation={[0, ox * 4, 0]}
            scale={0.78 * energyScale}
          >
            <meshPhysicalMaterial
              clearcoat={0.72}
              clearcoatRoughness={0.18}
              roughness={0.28}
              vertexColors
            />
          </mesh>
        ))}
      </group>

      <TrophicDeck
        color={BIOME_COLORS.heatAmber}
        height={0.24}
        width={w2}
        y={0.82}
      />
      <group position={[0, 0.86, 0]}>
        {Arr.map(PREDATOR_OFFSETS, ([ox, oz]) => (
          <mesh
            castShadow
            geometry={secondary}
            key={`sec-${ox}-${oz}`}
            position={[ox * w2, 0, oz * w2 * 0.55]}
            rotation={[0, ox > 0 ? -0.4 : 0.4, 0]}
            scale={0.82 * energyScale}
          >
            <meshPhysicalMaterial
              clearcoat={0.22}
              clearcoatRoughness={0.4}
              roughness={0.52}
              vertexColors
            />
          </mesh>
        ))}
      </group>

      <TrophicDeck
        color={BIOME_COLORS.predatorOrange}
        height={0.2}
        width={w3}
        y={1.18}
      />
      <group position={[0, 1.26, 0]} ref={apexRef}>
        <mesh
          castShadow
          geometry={apex}
          rotation={[0, -0.35, 0]}
          scale={0.85 * energyScale}
        >
          <meshPhysicalMaterial
            clearcoat={0.2}
            clearcoatRoughness={0.42}
            opacity={state.tertiaryKj > 0 ? 1 : 0.22}
            roughness={0.48}
            side={DoubleSide}
            transparent={state.tertiaryKj === 0}
            vertexColors
          />
        </mesh>
      </group>

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

      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.66, 0]}
      >
        <span>{parts.tertiaryConsumer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[-0.95, 1.04, 0.22]}
      >
        <span>{parts.secondaryConsumer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[0.88, 0.62, 0.45]}
      >
        <span>{parts.primaryConsumer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.24, 0.94]}
      >
        <span>{parts.producer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[-1.18, 0.48, 0.26]}
      >
        <span>{parts.decomposer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[1.24, 1.38, 0]}
      >
        <span>{parts.heatLoss}</span>
      </ThreeLabel>
    </group>
  );
}

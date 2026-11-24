import { useFrame, useThree } from "@react-three/fiber";
import type { PlantLifeCycle } from "@repo/design-system/components/contents/biology/growth/model";
import { evaluateGrowthCurve } from "@repo/design-system/components/contents/biology/growth/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const LEAF_NODES = [
  { angle: 0.4, id: "l1", ratio: 0.34, side: -1 },
  { angle: -0.4, id: "l2", ratio: 0.48, side: 1 },
  { angle: 0.35, id: "l3", ratio: 0.66, side: -1 },
  { angle: -0.35, id: "l4", ratio: 0.8, side: 1 },
] as const;

function GrowthCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [1.65, 1.45, 3.25] : [1.3, 1.25, 2.55]}
      cameraTarget={[0, 0.72, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.3}
    />
  );
}

export function PlantSpecimenScene({
  lifeCycle,
  onTickTime,
  time,
}: {
  readonly lifeCycle: PlantLifeCycle;
  readonly onTickTime: (deltaTime: number) => void;
  readonly time: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const plantRef = useRef<Group>(null);
  const swayRef = useRef(0);
  const sample = evaluateGrowthCurve(lifeCycle, time);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    const dt = simulationStep(delta);
    onTickTime(dt * 12);
    swayRef.current += dt * 1.8;
    if (plantRef.current !== null) {
      plantRef.current.rotation.z = Math.sin(swayRef.current) * 0.035;
    }
  });

  const stemHeight = 0.24 + sample.dryMass * 1.15;
  const stemRadius =
    lifeCycle === "perennial"
      ? 0.045 + sample.dryMass * 0.06
      : 0.035 + sample.dryMass * 0.028;
  const isSenescent = sample.phase === "senescence";
  const leafColor = isSenescent
    ? FOLIAGE_COLORS.senescentLeaf
    : FOLIAGE_COLORS.palisade;
  const hasFlower =
    (lifeCycle === "annual" && time > 64) ||
    (lifeCycle === "biennial" && time > 72);

  return (
    <group>
      <SimulationTicker running={playing} />
      <GrowthCamera />
      {/* Soil mound */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[0.92, 1.02, 0.1, 28]} />
        <meshStandardMaterial color={FOLIAGE_COLORS.soilBase} roughness={0.8} />
      </mesh>
      <group position={[0, 0.1, 0]} ref={plantRef}>
        {/* Main stem */}
        <mesh castShadow position={[0, stemHeight / 2, 0]}>
          <cylinderGeometry
            args={[stemRadius * 0.72, stemRadius, stemHeight, 16]}
          />
          <meshStandardMaterial
            color={
              lifeCycle === "perennial"
                ? FOLIAGE_COLORS.stemWood
                : FOLIAGE_COLORS.collenchymaWall
            }
            roughness={0.62}
          />
        </mesh>
        {/* Foliage leaves scaled by dry mass */}
        {Arr.map(LEAF_NODES, (node) => {
          const leafScale = Math.max(0.15, sample.dryMass);
          const y = stemHeight * node.ratio;
          return (
            <mesh
              castShadow
              key={node.id}
              position={[node.side * 0.18 * leafScale, y, 0]}
              rotation={[0, 0, node.side * (isSenescent ? 1.1 : 0.65)]}
              scale={[leafScale, leafScale * 0.45, leafScale * 0.6]}
            >
              <sphereGeometry args={[0.24, 14, 10]} />
              <meshStandardMaterial color={leafColor} roughness={0.48} />
            </mesh>
          );
        })}
        {/* Canopy crown for perennial or bloom for annual/biennial */}
        {lifeCycle === "perennial" ? (
          <mesh
            castShadow
            position={[0, stemHeight + 0.14, 0]}
            scale={[
              0.5 + sample.dryMass * 0.5,
              0.45 + sample.dryMass * 0.35,
              0.5 + sample.dryMass * 0.5,
            ]}
          >
            <dodecahedronGeometry args={[0.38, 1]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.spongy}
              roughness={0.55}
            />
          </mesh>
        ) : null}
        {hasFlower ? (
          <mesh castShadow position={[0, stemHeight + 0.08, 0]}>
            <octahedronGeometry args={[0.13, 0]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.flowerAccent}
              roughness={0.35}
            />
          </mesh>
        ) : null}
      </group>
    </group>
  );
}

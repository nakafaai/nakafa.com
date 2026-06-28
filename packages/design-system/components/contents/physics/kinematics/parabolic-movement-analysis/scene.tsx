"use client";

import { Sky, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  getProjectileLoopSample,
  getProjectilePoint,
  PROJECTILE_ASSET_PATHS,
  PROJECTILE_SCENE,
  type ProjectileMotionState,
  type ProjectileScenarioId,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/data";
import { Ocean } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/ocean";
import { getColor } from "@repo/design-system/lib/color";
import { type RefObject, useMemo, useRef } from "react";
import {
  CatmullRomCurve3,
  type Group,
  Mesh,
  type MeshBasicMaterial,
  type PointLight,
  Vector3,
} from "three";

const PIRATE_COLORS = {
  flashCore: getColor("YELLOW"),
  flashOuter: getColor("ORANGE", 500),
  ghostHalo: getColor("WHITE"),
  smoke: getColor("SLATE", 200),
} as const;

const SMOKE_COUNT = 16;
const SMOKE_PUFFS = Array.from({ length: SMOKE_COUNT }, (_, index) => ({
  id: `smoke-${index}`,
  index,
}));

type VectorTuple = [number, number, number];

export function PirateProjectileScene({
  motion,
}: {
  motion: ProjectileMotionState;
}) {
  const worldRef = useRef<Group>(null);

  return (
    <group ref={worldRef}>
      <SceneSky />
      <Ocean motion={motion} />
      <StartIsland />
      <TargetIsland motion={motion} />
      <Trajectory motion={motion} />
      <GhostBalls motion={motion} />
      <AnimatedCannonBall motion={motion} worldRef={worldRef} />
      <MuzzleBlast motion={motion} />
    </group>
  );
}

function SceneSky() {
  return (
    <Sky
      distance={450}
      mieCoefficient={0.006}
      mieDirectionalG={0.72}
      rayleigh={1.2}
      sunPosition={[8, 5, 6]}
      turbidity={4.2}
    />
  );
}

function StartIsland() {
  return (
    <group>
      <SceneAsset path={PROJECTILE_ASSET_PATHS.sandFoliage} scale={0.58} />
      <SceneAsset
        path={PROJECTILE_ASSET_PATHS.cannon}
        position={[0, 0.04, 0]}
        rotation={[0, PROJECTILE_SCENE.cannonRotationY, 0]}
        scale={PROJECTILE_SCENE.cannonScale}
      />
      <SceneAsset
        path={PROJECTILE_ASSET_PATHS.palm}
        position={[-1.25, 0.02, 1.15]}
        rotation={[0, -0.72, 0]}
        scale={0.3}
      />
      <SceneAsset
        path={PROJECTILE_ASSET_PATHS.rock}
        position={[-1.3, -0.02, -1.25]}
        rotation={[0, 0.8, 0]}
        scale={0.18}
      />
    </group>
  );
}

function TargetIsland({ motion }: { motion: ProjectileMotionState }) {
  const targetX = PROJECTILE_SCENE.launchOffset[0] + motion.rangeWorld;

  return (
    <group position={[targetX, 0, 0]}>
      <SceneAsset path={PROJECTILE_ASSET_PATHS.sand} scale={0.5} />
      <SceneAsset
        path={PROJECTILE_ASSET_PATHS.flag}
        position={[0.4, 0.02, 0.8]}
        rotation={[0, -0.45, 0]}
        scale={0.34}
      />
      <SceneAsset
        path={PROJECTILE_ASSET_PATHS.rock}
        position={[-0.9, -0.02, -0.95]}
        rotation={[0, 1.1, 0]}
        scale={0.16}
      />
      <SceneAsset
        path={PROJECTILE_ASSET_PATHS.ship}
        position={[...PROJECTILE_SCENE.shipOffset]}
        rotation={[0, Math.PI / 2, 0]}
        scale={PROJECTILE_SCENE.shipScale}
      />
    </group>
  );
}

function Trajectory({ motion }: { motion: ProjectileMotionState }) {
  const curve = useMemo(() => {
    const points = Array.from(
      { length: PROJECTILE_SCENE.trailSampleCount },
      (_, index) => {
        const progress = index / (PROJECTILE_SCENE.trailSampleCount - 1);
        const point = getProjectilePoint(motion, motion.flightTime * progress);

        return toScenePoint(point.x, point.y, 0);
      }
    );

    return new CatmullRomCurve3(points);
  }, [motion]);

  return (
    <mesh>
      <tubeGeometry args={[curve, 70, 0.03, 10, false]} />
      <meshBasicMaterial
        color={motion.scenario.color}
        opacity={0.82}
        transparent
      />
    </mesh>
  );
}

function GhostBalls({ motion }: { motion: ProjectileMotionState }) {
  return (
    <group>
      {motion.ghostTimes.map((time) => {
        const point = getProjectilePoint(motion, time);
        const progress = time / motion.flightTime;
        const markerScale = 0.62 + progress * 0.24;

        return (
          <group key={time} position={toSceneTuple(point.x, point.y, 0)}>
            <mesh scale={markerScale}>
              <sphereGeometry args={[PROJECTILE_SCENE.ballScale, 24, 16]} />
              <meshBasicMaterial
                color={PIRATE_COLORS.ghostHalo}
                depthWrite={false}
                opacity={0.48}
                transparent
              />
            </mesh>
            <mesh scale={markerScale * 0.62}>
              <sphereGeometry args={[PROJECTILE_SCENE.ballScale, 20, 14]} />
              <meshBasicMaterial
                color={motion.scenario.color}
                depthWrite={false}
                opacity={0.95}
                transparent
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function AnimatedCannonBall({
  motion,
  worldRef,
}: {
  motion: ProjectileMotionState;
  worldRef: RefObject<Group | null>;
}) {
  const ballRef = useRef<Group>(null);
  const startRef = useRef<number | null>(null);
  const scenarioRef = useRef<ProjectileScenarioId | null>(null);

  useFrame(({ clock }) => {
    if (!ballRef.current) {
      return;
    }

    if (
      startRef.current === null ||
      scenarioRef.current !== motion.scenario.id
    ) {
      scenarioRef.current = motion.scenario.id;
      startRef.current = clock.elapsedTime;
    }

    const sample = getProjectileLoopSample(
      motion,
      clock.elapsedTime - startRef.current
    );
    const position = toSceneTuple(sample.point.x, sample.point.y, 0);

    ballRef.current.position.set(...position);
    ballRef.current.rotation.z = -sample.point.x * 2.3;

    if (worldRef.current) {
      worldRef.current.position.x = -sample.point.x * 0.42;
    }
  });

  return (
    <group ref={ballRef} scale={PROJECTILE_SCENE.ballScale}>
      <SceneAsset path={PROJECTILE_ASSET_PATHS.ball} />
    </group>
  );
}

function MuzzleBlast({ motion }: { motion: ProjectileMotionState }) {
  const outerRef = useRef<MeshBasicMaterial>(null);
  const coreRef = useRef<MeshBasicMaterial>(null);
  const lightRef = useRef<PointLight>(null);
  const startRef = useRef<number | null>(null);
  const scenarioRef = useRef<ProjectileScenarioId | null>(null);

  useFrame(({ clock }) => {
    if (
      startRef.current === null ||
      scenarioRef.current !== motion.scenario.id
    ) {
      scenarioRef.current = motion.scenario.id;
      startRef.current = clock.elapsedTime;
    }

    const { flashPower } = getProjectileLoopSample(
      motion,
      clock.elapsedTime - startRef.current
    );

    if (outerRef.current) {
      outerRef.current.opacity = flashPower * 0.68;
    }

    if (coreRef.current) {
      coreRef.current.opacity = flashPower * 0.9;
    }

    if (lightRef.current) {
      lightRef.current.intensity = flashPower * 1.4;
    }
  });

  return (
    <group position={PROJECTILE_SCENE.launchOffset}>
      <pointLight
        color={PIRATE_COLORS.flashOuter}
        distance={3.2}
        intensity={0}
        ref={lightRef}
      />
      <mesh position={[0.25, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.22, 0.5, 28]} />
        <meshBasicMaterial
          color={PIRATE_COLORS.flashOuter}
          depthWrite={false}
          opacity={0}
          ref={outerRef}
          transparent
        />
      </mesh>
      <mesh position={[0.15, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.11, 0.28, 24]} />
        <meshBasicMaterial
          color={PIRATE_COLORS.flashCore}
          depthWrite={false}
          opacity={0}
          ref={coreRef}
          transparent
        />
      </mesh>
      <SmokePuffs motion={motion} />
    </group>
  );
}

function SmokePuffs({ motion }: { motion: ProjectileMotionState }) {
  return (
    <group>
      {SMOKE_PUFFS.map((puff) => (
        <SmokePuff index={puff.index} key={puff.id} motion={motion} />
      ))}
    </group>
  );
}

function SmokePuff({
  index,
  motion,
}: {
  index: number;
  motion: ProjectileMotionState;
}) {
  const puffRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);
  const startRef = useRef<number | null>(null);
  const scenarioRef = useRef<ProjectileScenarioId | null>(null);

  useFrame(({ clock }) => {
    if (!(puffRef.current && materialRef.current)) {
      return;
    }

    if (
      startRef.current === null ||
      scenarioRef.current !== motion.scenario.id
    ) {
      scenarioRef.current = motion.scenario.id;
      startRef.current = clock.elapsedTime;
    }

    const phase =
      ((clock.elapsedTime - startRef.current) * 0.95 + index / SMOKE_COUNT) % 1;
    const drift = phase * 0.95;
    const spread = Math.sin(index * 1.9) * phase * 0.28;

    puffRef.current.position.set(-drift, phase * 0.16, spread);
    puffRef.current.scale.setScalar(0.08 + phase * 0.32);
    materialRef.current.opacity = (1 - phase) * 0.2;
  });

  return (
    <mesh ref={puffRef}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicMaterial
        color={PIRATE_COLORS.smoke}
        depthWrite={false}
        opacity={0}
        ref={materialRef}
        transparent
      />
    </mesh>
  );
}

function SceneAsset({
  path,
  position,
  rotation,
  scale,
}: {
  path: string;
  position?: VectorTuple;
  rotation?: VectorTuple;
  scale?: number | VectorTuple;
}) {
  const { scene } = useGLTF(path);
  const model = useMemo(() => cloneModel(scene), [scene]);

  return (
    <primitive
      object={model}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}

function cloneModel(scene: Group) {
  const clone = scene.clone(true);

  clone.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;
  });

  return clone;
}

function toScenePoint(x: number, y: number, z: number) {
  return new Vector3(...toSceneTuple(x, y, z));
}

function toSceneTuple(x: number, y: number, z: number): VectorTuple {
  return [
    PROJECTILE_SCENE.launchOffset[0] + x,
    PROJECTILE_SCENE.launchOffset[1] + y,
    PROJECTILE_SCENE.launchOffset[2] + z,
  ];
}

useGLTF.preload(Object.values(PROJECTILE_ASSET_PATHS));

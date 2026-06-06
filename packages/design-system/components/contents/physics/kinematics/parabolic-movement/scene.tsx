"use client";

import { useFrame } from "@react-three/fiber";
import {
  getParabolicLoopSample,
  getProjectilePoint,
  getProjectileVelocityAt,
  PARABOLIC_SCENE,
  type ParabolicLaunchId,
  type ParabolicMotionState,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import { getColor } from "@repo/design-system/lib/color";
import { useMemo, useRef } from "react";
import { CatmullRomCurve3, type Group, Vector3 } from "three";

const PROJECTILE_COLORS = {
  ballBand: getColor("SLATE", 50),
  ground: getColor("SLATE", 50),
  groundEdge: getColor("AMBER", 500),
  landingMat: getColor("EMERALD", 100),
  launcherBase: getColor("SLATE", 600),
  launcherRail: getColor("SLATE", 700),
  trailGhost: getColor("WHITE"),
} as const;

type VectorTuple = [number, number, number];

export function ProjectileBallScene({
  motion,
}: {
  motion: ParabolicMotionState;
}) {
  return (
    <group>
      <ProjectileRange motion={motion} />
      <Trajectory motion={motion} />
      <GhostBalls motion={motion} />
      <AnimatedBall motion={motion} />
    </group>
  );
}

function ProjectileRange({ motion }: { motion: ParabolicMotionState }) {
  const groundLength = getGroundLength(motion.rangeWorld);
  const end = getProjectilePoint(motion, motion.flightTime);

  return (
    <group>
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <boxGeometry args={[groundLength, 0.08, PARABOLIC_SCENE.groundWidth]} />
        <meshStandardMaterial
          color={PROJECTILE_COLORS.ground}
          roughness={0.82}
        />
      </mesh>
      <mesh position={[0, 0.02, -PARABOLIC_SCENE.groundWidth / 2]}>
        <boxGeometry args={[groundLength, 0.04, 0.07]} />
        <meshStandardMaterial color={PROJECTILE_COLORS.groundEdge} />
      </mesh>
      <mesh position={[0, 0.02, PARABOLIC_SCENE.groundWidth / 2]}>
        <boxGeometry args={[groundLength, 0.04, 0.07]} />
        <meshStandardMaterial color={PROJECTILE_COLORS.groundEdge} />
      </mesh>
      <mesh position={[end.x, 0.03, 0]} receiveShadow>
        <boxGeometry args={[0.85, 0.05, 1.1]} />
        <meshStandardMaterial
          color={PROJECTILE_COLORS.landingMat}
          roughness={0.78}
        />
      </mesh>
      <LaunchRamp motion={motion} />
    </group>
  );
}

function LaunchRamp({ motion }: { motion: ParabolicMotionState }) {
  const pose = getLaunchRampPose(motion);

  return (
    <group>
      <mesh position={[pose.base.x, 0.015, 0]} receiveShadow>
        <boxGeometry args={[0.62, 0.05, 0.72]} />
        <meshStandardMaterial
          color={PROJECTILE_COLORS.launcherBase}
          roughness={0.58}
        />
      </mesh>
      <mesh castShadow position={[pose.base.x, pose.base.y / 2, -0.2]}>
        <cylinderGeometry args={[0.035, 0.035, pose.base.y, 16]} />
        <meshStandardMaterial
          color={PROJECTILE_COLORS.launcherBase}
          roughness={0.45}
        />
      </mesh>
      <mesh castShadow position={[pose.base.x, pose.base.y / 2, 0.2]}>
        <cylinderGeometry args={[0.035, 0.035, pose.base.y, 16]} />
        <meshStandardMaterial
          color={PROJECTILE_COLORS.launcherBase}
          roughness={0.45}
        />
      </mesh>
      <group position={pose.center} rotation={[0, 0, pose.angle]}>
        <mesh castShadow position={[0, 0, -0.14]}>
          <boxGeometry args={[pose.length, 0.055, 0.045]} />
          <meshStandardMaterial
            color={PROJECTILE_COLORS.launcherRail}
            roughness={0.34}
          />
        </mesh>
        <mesh castShadow position={[0, 0, 0.14]}>
          <boxGeometry args={[pose.length, 0.055, 0.045]} />
          <meshStandardMaterial
            color={PROJECTILE_COLORS.launcherRail}
            roughness={0.34}
          />
        </mesh>
      </group>
    </group>
  );
}

function Trajectory({ motion }: { motion: ParabolicMotionState }) {
  const curve = useMemo(() => {
    const points = Array.from(
      { length: PARABOLIC_SCENE.trailSampleCount },
      (_, index) => {
        const progress = index / (PARABOLIC_SCENE.trailSampleCount - 1);
        const point = getProjectilePoint(motion, motion.flightTime * progress);

        return toScenePoint(point.x, point.y, 0);
      }
    );

    return new CatmullRomCurve3(points);
  }, [motion]);

  return (
    <mesh>
      <tubeGeometry args={[curve, 84, 0.026, 10, false]} />
      <meshBasicMaterial
        color={motion.scenario.color}
        opacity={0.78}
        transparent
      />
    </mesh>
  );
}

function GhostBalls({ motion }: { motion: ParabolicMotionState }) {
  return (
    <group>
      {motion.ghostTimes.map((time) => {
        const point = getProjectilePoint(motion, time);
        const progress = time / motion.flightTime;
        const opacity = 0.18 + progress * 0.12;

        return (
          <group key={time} position={toSceneTuple(point.x, point.y, 0)}>
            <mesh>
              <sphereGeometry args={[PARABOLIC_SCENE.ballRadius, 32, 18]} />
              <meshBasicMaterial
                color={PROJECTILE_COLORS.trailGhost}
                depthWrite={false}
                opacity={opacity}
                transparent
              />
            </mesh>
            <mesh scale={0.48}>
              <sphereGeometry args={[PARABOLIC_SCENE.ballRadius, 24, 14]} />
              <meshBasicMaterial
                color={motion.scenario.color}
                depthWrite={false}
                opacity={0.74}
                transparent
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function AnimatedBall({ motion }: { motion: ParabolicMotionState }) {
  const ballRef = useRef<Group>(null);
  const startRef = useRef<number | null>(null);
  const scenarioRef = useRef<ParabolicLaunchId | null>(null);

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

    const sample = getParabolicLoopSample(
      motion,
      clock.elapsedTime - startRef.current
    );
    const velocity = getProjectileVelocityAt(motion, sample.time);
    const heading = Math.atan2(
      velocity.verticalVelocity,
      velocity.horizontalVelocity
    );
    const spin =
      (sample.point.xMeters * PARABOLIC_SCENE.worldScale) /
      PARABOLIC_SCENE.ballRadius;

    ballRef.current.position.set(
      ...toSceneTuple(sample.point.x, sample.point.y, 0)
    );
    ballRef.current.rotation.set(0, 0, heading);
    ballRef.current.children[0]?.rotation.set(0, 0, -spin);
  });

  return (
    <group ref={ballRef}>
      <ProjectileBall color={motion.scenario.color} />
    </group>
  );
}

function ProjectileBall({ color }: { color: string }) {
  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[PARABOLIC_SCENE.ballRadius, 48, 24]} />
        <meshStandardMaterial color={color} metalness={0.05} roughness={0.34} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry
          args={[PARABOLIC_SCENE.ballRadius * 1.01, 0.012, 10, 64]}
        />
        <meshStandardMaterial
          color={PROJECTILE_COLORS.ballBand}
          roughness={0.42}
        />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry
          args={[PARABOLIC_SCENE.ballRadius * 1.01, 0.01, 10, 64]}
        />
        <meshStandardMaterial
          color={PROJECTILE_COLORS.ballBand}
          roughness={0.42}
        />
      </mesh>
    </group>
  );
}

function getLaunchRampPose(motion: ParabolicMotionState) {
  const start = getProjectilePoint(motion, 0);
  const angle = motion.angleRadians;
  const length = getLauncherLength(angle);
  const launchY = getProjectileSceneY(start.y);
  const base = {
    x: start.x - Math.cos(angle) * length,
    y: launchY - Math.sin(angle) * length,
  };
  const center = new Vector3((start.x + base.x) / 2, (launchY + base.y) / 2, 0);

  return {
    angle,
    base,
    center: center.toArray() as VectorTuple,
    length,
  };
}

function getGroundLength(rangeWorld: number) {
  return rangeWorld + PARABOLIC_SCENE.groundPadding;
}

/** Keeps the projectile center on the visible contact plane when y = 0. */
function getProjectileSceneY(y: number) {
  return PARABOLIC_SCENE.ballRadius + y;
}

/** Keeps the launch rail above the ground while preserving the launch angle. */
function getLauncherLength(angle: number) {
  const minimumSine = 0.1;
  const safeSine = Math.max(Math.sin(angle), minimumSine);
  const maximumGroundedLength = PARABOLIC_SCENE.ballRadius / safeSine;

  return Math.min(PARABOLIC_SCENE.launcherLength, maximumGroundedLength * 0.9);
}

function toScenePoint(x: number, y: number, z: number) {
  return new Vector3(...toSceneTuple(x, y, z));
}

function toSceneTuple(x: number, y: number, z: number): VectorTuple {
  return [x, getProjectileSceneY(y), z];
}

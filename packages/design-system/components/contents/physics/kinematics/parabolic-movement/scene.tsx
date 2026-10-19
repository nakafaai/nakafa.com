"use client";

import { useReducedMotion } from "@mantine/hooks";
import { useFrame } from "@react-three/fiber";
import { useParabolicMotion } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/context";
import {
  getParabolicLoopSample,
  getProjectilePoint,
  getProjectileSceneY,
  getProjectileVelocityAt,
  getRestingProjectileSample,
  PARABOLIC_SCENE,
  type ParabolicLaunchId,
  type ParabolicMotionState,
  toSceneTuple,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import { ProjectileRange } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/ground";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import { CatmullRomCurve3, type Group, Vector3 } from "three";

const PROJECTILE_COLORS = {
  ballBand: getColor("SLATE", 50),
  trailGhost: getColor("WHITE"),
} as const;

/** The color of each launch's trail and ball. */
const LAUNCH_COLORS = {
  "low-angle": getColor("TEAL"),
  "balanced-angle": getColor("ORANGE", 500),
  "high-angle": getColor("VIOLET"),
} satisfies Record<ParabolicLaunchId, string>;

export function ProjectileBallScene() {
  return (
    <group>
      <ProjectileRange />
      <Trajectory />
      <GhostBalls />
      <AnimatedBall />
    </group>
  );
}

function Trajectory() {
  const motion = useParabolicMotion();
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
        color={LAUNCH_COLORS[motion.scenario.id]}
        opacity={0.78}
        transparent
      />
    </mesh>
  );
}

function GhostBalls() {
  const motion = useParabolicMotion();
  return (
    <group>
      {Arr.map(motion.ghostTimes, (time) => {
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
                color={LAUNCH_COLORS[motion.scenario.id]}
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

function AnimatedBall() {
  const motion = useParabolicMotion();
  const ballRef = useRef<Group>(null);
  const startRef = useRef<number | null>(null);
  const scenarioRef = useRef<ParabolicLaunchId | null>(null);
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });

  useFrame(({ clock }) => {
    if (!ballRef.current) {
      return;
    }

    // With reduced motion the ball rests at the top of its arc and never flies.
    if (calm) {
      placeBall(ballRef.current, motion, getRestingProjectileSample(motion));
      return;
    }

    if (
      startRef.current === null ||
      scenarioRef.current !== motion.scenario.id
    ) {
      scenarioRef.current = motion.scenario.id;
      startRef.current = clock.elapsedTime;
    }

    placeBall(
      ballRef.current,
      motion,
      getParabolicLoopSample(motion, clock.elapsedTime - startRef.current)
    );
  });

  return (
    <CameraBounds
      motion={{
        rotation: "all",
        translation: {
          x: { min: -motion.rangeWorld / 2, max: motion.rangeWorld / 2 },
          y: {
            min: getProjectileSceneY(0),
            max: getProjectileSceneY(motion.peakWorld),
          },
          z: { min: 0, max: 0 },
        },
      }}
      objectRef={ballRef}
    >
      <group>
        <ProjectileBall color={LAUNCH_COLORS[motion.scenario.id]} />
      </group>
    </CameraBounds>
  );
}

/**
 * Places the ball, its heading and its spin for one sample of its flight. The
 * heading follows the vertical speed at that moment, and the spin follows the
 * distance flown, so the ball turns over the ground it crosses.
 */
function placeBall(
  ball: Group,
  motion: ParabolicMotionState,
  sample: Pick<ReturnType<typeof getParabolicLoopSample>, "point" | "time">
) {
  const velocity = getProjectileVelocityAt(motion, sample.time);
  const heading = Math.atan2(
    velocity.verticalVelocity,
    velocity.horizontalVelocity
  );
  const spin =
    (sample.point.xMeters * PARABOLIC_SCENE.worldScale) /
    PARABOLIC_SCENE.ballRadius;

  ball.position.set(...toSceneTuple(sample.point.x, sample.point.y, 0));
  ball.rotation.set(0, 0, heading);
  ball.children[0]?.rotation.set(0, 0, -spin);
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

function toScenePoint(x: number, y: number, z: number) {
  return new Vector3(...toSceneTuple(x, y, z));
}

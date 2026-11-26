import { useReducedMotion } from "@mantine/hooks";
import { useFrame } from "@react-three/fiber";
import { SportsBall } from "@repo/design-system/components/contents/physics/kinematics/ball";
import { useParabolicMotion } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/context";
import type {
  ParabolicLaunchId,
  ParabolicMotionState,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import {
  getParabolicLoopSample,
  getProjectilePoint,
  getProjectileSceneY,
  getProjectileVelocityAt,
  getRestingProjectileSample,
  PARABOLIC_SCENE,
  toSceneTuple,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import { ProjectileRange } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/ground";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { CatmullRomCurve3, Vector3 } from "three";

const PROJECTILE_COLORS = {
  ballBand: getColor("SLATE", 50),
  trailGhost: getColor("WHITE"),
} as const;

/** The color of each launch's trail and ball. */
const LAUNCH_COLORS = {
  "low-angle": PLOT_COLORS.teal,
  "balanced-angle": PLOT_COLORS.orange,
  "high-angle": PLOT_COLORS.violet,
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
        toneMapped={false}
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
        const opacity = 0.16 + progress * 0.1;

        return (
          <group key={time} position={toSceneTuple(point.x, point.y, 0)}>
            <mesh>
              <sphereGeometry args={[PARABOLIC_SCENE.ballRadius, 32, 18]} />
              <meshBasicMaterial
                color={PROJECTILE_COLORS.trailGhost}
                depthWrite={false}
                opacity={opacity}
                toneMapped={false}
                transparent
              />
            </mesh>
            <mesh scale={0.44}>
              <sphereGeometry args={[PARABOLIC_SCENE.ballRadius, 24, 14]} />
              <meshBasicMaterial
                color={LAUNCH_COLORS[motion.scenario.id]}
                depthWrite={false}
                opacity={0.74}
                toneMapped={false}
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
  const playing = useVisualScene((card) => card.playing, false);
  const motion = useParabolicMotion();
  const ballRef = useRef<Group>(null);
  const elapsedRef = useRef(motion.flightTime * 0.5);
  const scenarioRef = useRef<ParabolicLaunchId>(motion.scenario.id);
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });

  useVisualStop(() => {
    elapsedRef.current = 0;
    if (ballRef.current) {
      placeBall(ballRef.current, motion, getParabolicLoopSample(motion, 0));
    }
  });

  useFrame((_, delta) => {
    if (!ballRef.current) {
      return;
    }

    // With reduced motion the ball rests at the top of its arc and never flies.
    if (calm) {
      placeBall(ballRef.current, motion, getRestingProjectileSample(motion));
      return;
    }

    if (scenarioRef.current !== motion.scenario.id) {
      scenarioRef.current = motion.scenario.id;
      elapsedRef.current = motion.flightTime * 0.5;
    }

    if (playing) {
      elapsedRef.current += simulationStep(delta);
    }

    placeBall(
      ballRef.current,
      motion,
      getParabolicLoopSample(motion, elapsedRef.current)
    );
  });

  return (
    <>
      <SimulationTicker running={playing && !calm} />
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
    </>
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
      <SportsBall
        color={color}
        radius={PARABOLIC_SCENE.ballRadius}
        seamColor={PROJECTILE_COLORS.ballBand}
      />
    </group>
  );
}

function toScenePoint(x: number, y: number, z: number) {
  return new Vector3(...toSceneTuple(x, y, z));
}

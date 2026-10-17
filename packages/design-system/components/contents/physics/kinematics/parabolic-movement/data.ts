import { formatTrimmedNumber } from "@repo/design-system/components/contents/physics/kinematics/number";
import { Array as Arr, Number as Num, Schema } from "effect";

const ParabolicLaunchIdSchema = Schema.Literals([
  "low-angle",
  "balanced-angle",
  "high-angle",
]);
export type ParabolicLaunchId = typeof ParabolicLaunchIdSchema.Type;

const ParabolicLaunchScenarioSchema = Schema.Struct({
  angleDegrees: Schema.Finite,
  id: ParabolicLaunchIdSchema,
  initialSpeed: Schema.Finite,
});
type ParabolicLaunchScenario = typeof ParabolicLaunchScenarioSchema.Type;

export type VectorTuple = [number, number, number];

const PARABOLIC_CAMERA_POSITION: VectorTuple = [-4.7, 3.15, 5.35];
const PARABOLIC_CAMERA_TARGET: VectorTuple = [0, 0.85, 0];

const PARABOLIC_GRAVITY = 10;
export const DEFAULT_PARABOLIC_LAUNCH_ID =
  "balanced-angle" satisfies ParabolicLaunchId;

export const PARABOLIC_SCENE = {
  animationSeconds: 4,
  ballRadius: 0.2,
  cameraFov: 38,
  cameraPosition: PARABOLIC_CAMERA_POSITION,
  cameraTarget: PARABOLIC_CAMERA_TARGET,
  ghostCount: 7,
  groundPadding: 1.9,
  groundWidth: 3,
  launcherLength: 0.58,

  pauseSeconds: 0.9,
  trailSampleCount: 72,
  worldScale: 0.08,
} as const;

/** The scenario of each launch. Every launch starts at the same speed, so only its angle differs. */
const PARABOLIC_LAUNCH_SCENARIOS = {
  "low-angle": {
    angleDegrees: 28,
    id: "low-angle",
    initialSpeed: 22,
  },
  "balanced-angle": {
    angleDegrees: 45,
    id: "balanced-angle",
    initialSpeed: 22,
  },
  "high-angle": {
    angleDegrees: 64,
    id: "high-angle",
    initialSpeed: 22,
  },
} satisfies Record<ParabolicLaunchId, ParabolicLaunchScenario>;

/** The launches in the order the lab lists them. */
export const PARABOLIC_LAUNCHES: ParabolicLaunchScenario[] = Arr.map(
  ParabolicLaunchIdSchema.literals,
  (id) => PARABOLIC_LAUNCH_SCENARIOS[id]
);

export type ParabolicMotionState = ReturnType<typeof getParabolicMotionState>;

export function isParabolicLaunchId(value: string): value is ParabolicLaunchId {
  return Arr.some(PARABOLIC_LAUNCHES, (launch) => launch.id === value);
}

export function getParabolicMotionState(id: ParabolicLaunchId) {
  const scenario: ParabolicLaunchScenario = PARABOLIC_LAUNCH_SCENARIOS[id];
  const angleRadians = (scenario.angleDegrees * Math.PI) / 180;
  const horizontalVelocity = scenario.initialSpeed * Math.cos(angleRadians);
  const verticalVelocity = scenario.initialSpeed * Math.sin(angleRadians);
  const peakTime = verticalVelocity / PARABOLIC_GRAVITY;
  const flightTime = 2 * peakTime;
  const range = horizontalVelocity * flightTime;
  const peakHeight = verticalVelocity ** 2 / (2 * PARABOLIC_GRAVITY);
  const rangeWorld = range * PARABOLIC_SCENE.worldScale;
  const peakWorld = peakHeight * PARABOLIC_SCENE.worldScale;
  const ghostTimes = getEqualTimeSamples(
    flightTime,
    PARABOLIC_SCENE.ghostCount
  );

  return {
    angleRadians,
    flightTime,
    ghostTimes,
    horizontalVelocity,
    peakHeight,
    peakTime,
    peakWorld,
    range,
    rangeWorld,
    scenario,
    verticalVelocity,
  };
}

export function getProjectilePoint(motion: ParabolicMotionState, time: number) {
  const safeTime = Num.clamp(time, { minimum: 0, maximum: motion.flightTime });
  const xMeters = motion.horizontalVelocity * safeTime;
  const yMeters =
    motion.verticalVelocity * safeTime -
    (PARABOLIC_GRAVITY * safeTime ** 2) / 2;

  return {
    time: safeTime,
    x: (xMeters - motion.range / 2) * PARABOLIC_SCENE.worldScale,
    xMeters,
    y: yMeters * PARABOLIC_SCENE.worldScale,
    yMeters,
  };
}

export function getProjectileVelocityAt(
  motion: ParabolicMotionState,
  time: number
) {
  const safeTime = Num.clamp(time, { minimum: 0, maximum: motion.flightTime });

  return {
    horizontalVelocity: motion.horizontalVelocity,
    verticalVelocity: motion.verticalVelocity - PARABOLIC_GRAVITY * safeTime,
  };
}

export function getParabolicLoopSample(
  motion: ParabolicMotionState,
  elapsed: number
) {
  const cycleSeconds =
    PARABOLIC_SCENE.animationSeconds + PARABOLIC_SCENE.pauseSeconds;
  const cycleTime = elapsed % cycleSeconds;
  const progress = Math.min(cycleTime / PARABOLIC_SCENE.animationSeconds, 1);
  const time = motion.flightTime * progress;

  return {
    cycleTime,
    isFlying: progress < 1,
    point: getProjectilePoint(motion, time),
    progress,
    time,
  };
}

/**
 * The pose of a projectile at rest for reduced motion: the top of its arc, where
 * its vertical speed is zero and its height is the peak height of the launch.
 */
export function getRestingProjectileSample(motion: ParabolicMotionState) {
  return {
    point: getProjectilePoint(motion, motion.peakTime),
    time: motion.peakTime,
  };
}

/** Keeps the projectile center on the visible contact plane when y = 0. */
export function getProjectileSceneY(y: number) {
  return PARABOLIC_SCENE.ballRadius + y;
}

/** The scene position of one point of the flight, with its height lifted onto the contact plane. */
export function toSceneTuple(x: number, y: number, z: number): VectorTuple {
  return [x, getProjectileSceneY(y), z];
}

export function formatAngleMath(value: number) {
  return `\\theta=${formatTrimmedNumber(value)}^\\circ`;
}

function getEqualTimeSamples(duration: number, sampleCount: number) {
  return Array.from(
    { length: sampleCount },
    (_, index) => (duration * index) / (sampleCount - 1)
  );
}

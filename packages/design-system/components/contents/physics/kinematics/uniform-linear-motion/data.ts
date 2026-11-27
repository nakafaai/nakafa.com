import { lerp } from "@repo/design-system/components/contents/physics/kinematics/lerp";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";

export const UNIFORM_LINEAR_MOTION_SPEEDS = [2, 4, 6] as const;

export type UniformLinearMotionSpeed =
  (typeof UNIFORM_LINEAR_MOTION_SPEEDS)[number];

export const UNIFORM_LINEAR_MOTION_SCENE = {
  carScale: 0.62,
  durationSeconds: 5,
  positionStepSeconds: 1,
  roadWidth: 1.8,
  stripeLength: 0.42,
  stripeSpacing: 1.5,
  worldScale: 0.2,
} as const;

export const UNIFORM_LINEAR_MOTION_CAMERA = {
  cameraPosition: [4.8, 3.3, 6.4],
  cameraTarget: [0, 0.16, 0],
} satisfies Record<string, readonly [number, number, number]>;

export const UNIFORM_LINEAR_MOTION_COLORS = {
  car: PLOT_COLORS.orange,
  positionMark: PLOT_COLORS.teal,
  track: PLOT_COLORS.teal,
} as const;

export type UniformLinearMotionState = ReturnType<
  typeof getUniformLinearMotionState
>;

export function getUniformLinearMotionState(speed: UniformLinearMotionSpeed) {
  const duration = UNIFORM_LINEAR_MOTION_SCENE.durationSeconds;
  const timeStep = UNIFORM_LINEAR_MOTION_SCENE.positionStepSeconds;
  const traveledDistance = speed * duration;
  const startX =
    -(traveledDistance * UNIFORM_LINEAR_MOTION_SCENE.worldScale) / 2;
  const endX = -startX;
  const sampleCount = Math.floor(duration / timeStep) + 1;
  const samples = Array.from({ length: sampleCount }, (_, index) => {
    const time = index * timeStep;
    const progress = time / duration;
    const position = speed * time;

    return {
      position,
      time,
      x: lerp(startX, endX, progress),
    };
  });

  return {
    duration,
    endX,
    samples,
    speed,
    startX,
    stepDistance: speed * timeStep,
    timeStep,
    trackCenterX: (startX + endX) / 2,
    trackLength: endX - startX,
    traveledDistance,
  };
}

export function isUniformLinearMotionSpeed(
  value: number
): value is UniformLinearMotionSpeed {
  return Arr.some(UNIFORM_LINEAR_MOTION_SPEEDS, (speed) => speed === value);
}

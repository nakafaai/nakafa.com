import { lerp } from "@repo/design-system/components/contents/physics/kinematics/lerp";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr } from "effect";

export const UNIFORM_LINEAR_MOTION_CAR_MODEL_PATH =
  "/models/physics/kinematics/kenney-car-kit/sedan-sports.glb";

export const UNIFORM_LINEAR_MOTION_SPEEDS = [2, 4, 6] as const;

export type UniformLinearMotionSpeed =
  (typeof UNIFORM_LINEAR_MOTION_SPEEDS)[number];

export const UNIFORM_LINEAR_MOTION_SCENE = {
  carScale: 0.62,
  durationSeconds: 5,
  positionStepSeconds: 1,
  roadContextMultiplier: 8,
  roadMinimumLength: 70,
  roadWidth: 1.8,
  stripeLength: 0.42,
  stripeSpacing: 1.5,
  stripeWidth: 0.06,
  worldScale: 0.2,
} as const;

export const UNIFORM_LINEAR_MOTION_CAMERA = {
  cameraPosition: [4.8, 3.3, 6.4],
  cameraTarget: [0, 0.16, 0],
} satisfies Record<string, readonly [number, number, number]>;

export const UNIFORM_LINEAR_MOTION_COLORS = {
  car: getColor("ORANGE"),
  positionMark: getColor("TEAL"),
  road: getColor("GRAY", 800),
  stripe: getColor("SLATE", 50),
  track: getColor("TEAL"),
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
  const roadLength = getRoadLength(traveledDistance);

  return {
    duration,
    endX,
    roadLength,
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

function getRoadLength(distanceMeters: number) {
  const distanceLength =
    distanceMeters * UNIFORM_LINEAR_MOTION_SCENE.worldScale;
  const contextualLength =
    distanceLength * UNIFORM_LINEAR_MOTION_SCENE.roadContextMultiplier;

  return Math.max(
    UNIFORM_LINEAR_MOTION_SCENE.roadMinimumLength,
    contextualLength
  );
}

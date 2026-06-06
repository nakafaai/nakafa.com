import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

export const VELOCITY_SPEED_CAR_MODEL_PATH =
  "/models/physics/kinematics/poly-pizza-dodge-charger/dodge-charger.glb";

export const VELOCITY_SPEED_CASE_IDS = [
  "forward",
  "partialReturn",
  "backToStart",
] as const;

export type VelocitySpeedCaseId = (typeof VELOCITY_SPEED_CASE_IDS)[number];

export interface VelocitySpeedLabLabels {
  chooseCase: string;
  factLabels: {
    displacement: ReactNode;
    distance: ReactNode;
    speed: ReactNode;
    velocity: ReactNode;
  };
  modeLabels: Record<VelocitySpeedCaseId, ReactNode>;
  viewLabel: string;
}

export interface VelocitySpeedLabProps {
  description: ReactNode;
  labels: VelocitySpeedLabLabels;
  title: ReactNode;
}

interface MotionConfig {
  backDistance: number;
  duration: number;
  forwardDistance: number;
}

export interface MotionSegment {
  direction: -1 | 1;
  distance: number;
  endX: number;
  startX: number;
}

export const VELOCITY_SPEED_SCENE = {
  carScale: 0.36,
  laneLength: 94,
  laneWidth: 1.82,
  motionCenterRatio: 0,
  stripeLength: 0.42,
  stripeSpacing: 1.38,
  stripeWidth: 0.05,
  worldScale: 0.56,
} as const;

const CAMERA_COMPOSITION = {
  depthRatio: 0.9,
  fov: 30,
  horizontalRatio: 0.28,
  markerPaddingLanes: 1.9,
  objectPaddingLanes: 2.1,
  routePaddingRatio: 0.22,
  targetHeightRatio: 0.04,
  verticalRatio: 0.52,
} as const;

export const VELOCITY_SPEED_COLORS = {
  carBody: getColor("RED", 500),
  coneBand: getColor("SLATE", 50),
  coneBase: getColor("GRAY", 800),
  coneBody: getColor("ORANGE", 500),
  displacementGuide: getColor("VIOLET"),
  distanceGuide: getColor("TEAL", 500),
  lane: getColor("SLATE", 800),
  stripe: getColor("SLATE", 50),
} as const;

const MOTION_CONFIGS: Record<VelocitySpeedCaseId, MotionConfig> = {
  backToStart: {
    backDistance: 16,
    duration: 4,
    forwardDistance: 16,
  },
  forward: {
    backDistance: 0,
    duration: 4,
    forwardDistance: 16,
  },
  partialReturn: {
    backDistance: 8,
    duration: 4,
    forwardDistance: 16,
  },
};

const ROUTE_BOUNDS = getRouteBounds(Object.values(MOTION_CONFIGS));
const SCENE_BOUNDS = getPaddedRouteBounds(ROUTE_BOUNDS);
const CAMERA_TARGET = getCameraTarget(SCENE_BOUNDS);
const CAMERA_POSITION = getCameraPosition(SCENE_BOUNDS, CAMERA_TARGET);

export const VELOCITY_SPEED_CAMERA = {
  cameraPosition: CAMERA_POSITION,
  cameraTarget: CAMERA_TARGET,
  fov: CAMERA_COMPOSITION.fov,
  maxDistance: 26,
  minDistance: 5,
} satisfies {
  cameraPosition: readonly [number, number, number];
  cameraTarget: readonly [number, number, number];
  fov: number;
  maxDistance: number;
  minDistance: number;
};

export type VelocitySpeedState = ReturnType<typeof getVelocitySpeedState>;

export function getVelocitySpeedState(caseId: VelocitySpeedCaseId) {
  const config = MOTION_CONFIGS[caseId];
  const forwardWorldDistance =
    config.forwardDistance * VELOCITY_SPEED_SCENE.worldScale;
  const backWorldDistance =
    config.backDistance * VELOCITY_SPEED_SCENE.worldScale;
  const motionCenterX = getMotionCenterX(config.forwardDistance);
  const startX = motionCenterX - forwardWorldDistance / 2;
  const turnX = startX + forwardWorldDistance;
  const endX = turnX - backWorldDistance;
  const distance = config.forwardDistance + config.backDistance;
  const displacement = config.forwardDistance - config.backDistance;
  const segments = createMotionSegments({
    backDistance: config.backDistance,
    endX,
    forwardDistance: config.forwardDistance,
    startX,
    turnX,
  });

  return {
    caseId,
    displacement,
    distance,
    duration: config.duration,
    endX,
    segments,
    speed: distance / config.duration,
    startX,
    turnX,
    velocity: displacement / config.duration,
  };
}

export function getVelocitySpeedSample(
  motion: VelocitySpeedState,
  elapsedSeconds: number
) {
  const elapsed = Math.min(Math.max(elapsedSeconds, 0), motion.duration);
  const targetDistance = (elapsed / motion.duration) * motion.distance;
  let traveled = 0;

  for (const segment of motion.segments) {
    const nextTraveled = traveled + segment.distance;

    if (targetDistance <= nextTraveled) {
      const segmentProgress =
        (targetDistance - traveled) / segment.distance || 0;

      return {
        direction: segment.direction,
        x: lerp(segment.startX, segment.endX, segmentProgress),
      };
    }

    traveled = nextTraveled;
  }

  const lastSegment = motion.segments.at(-1);

  return {
    direction: lastSegment?.direction ?? 1,
    x: motion.endX,
  };
}

export function isVelocitySpeedCaseId(
  value: string
): value is VelocitySpeedCaseId {
  return VELOCITY_SPEED_CASE_IDS.some((caseId) => caseId === value);
}

export function formatMeterMath(value: number) {
  return `${formatNumber(value)}\\text{ m}`;
}

export function formatSignedMeterMath(value: number) {
  if (value === 0) {
    return "0\\text{ m}";
  }

  return `${formatSignedNumber(value)}\\text{ m}`;
}

export function formatSpeedMath(value: number) {
  return `${formatNumber(value)}\\text{ m/s}`;
}

export function formatSignedSpeedMath(value: number) {
  if (value === 0) {
    return "0\\text{ m/s}";
  }

  return `${formatSignedNumber(value)}\\text{ m/s}`;
}

function createMotionSegments({
  backDistance,
  endX,
  forwardDistance,
  startX,
  turnX,
}: {
  backDistance: number;
  endX: number;
  forwardDistance: number;
  startX: number;
  turnX: number;
}): MotionSegment[] {
  const segments: MotionSegment[] = [
    {
      direction: 1,
      distance: forwardDistance,
      endX: turnX,
      startX,
    },
  ];

  if (backDistance === 0) {
    return segments;
  }

  return [
    ...segments,
    {
      direction: -1,
      distance: backDistance,
      endX,
      startX: turnX,
    },
  ];
}

function getRouteBounds(configs: MotionConfig[]) {
  const routeXPositions = configs.flatMap((config) => {
    const forwardWorldDistance =
      config.forwardDistance * VELOCITY_SPEED_SCENE.worldScale;
    const backWorldDistance =
      config.backDistance * VELOCITY_SPEED_SCENE.worldScale;
    const motionCenterX = getMotionCenterX(config.forwardDistance);
    const startX = motionCenterX - forwardWorldDistance / 2;
    const turnX = startX + forwardWorldDistance;
    const endX = turnX - backWorldDistance;

    return [startX, turnX, endX];
  });
  const minX = Math.min(...routeXPositions);
  const maxX = Math.max(...routeXPositions);

  return createBounds(minX, maxX);
}

function getPaddedRouteBounds(bounds: ReturnType<typeof createBounds>) {
  const routePadding = bounds.span * CAMERA_COMPOSITION.routePaddingRatio;
  const markerPadding =
    VELOCITY_SPEED_SCENE.laneWidth * CAMERA_COMPOSITION.markerPaddingLanes;
  const objectPadding =
    VELOCITY_SPEED_SCENE.laneWidth * CAMERA_COMPOSITION.objectPaddingLanes;
  const padding = Math.max(routePadding, markerPadding, objectPadding);

  return createBounds(bounds.minX - padding, bounds.maxX + padding);
}

function createBounds(minX: number, maxX: number) {
  return {
    centerX: (minX + maxX) / 2,
    maxX,
    minX,
    span: maxX - minX,
  };
}

function getCameraTarget(bounds: ReturnType<typeof createBounds>) {
  return [
    bounds.centerX,
    bounds.span * CAMERA_COMPOSITION.targetHeightRatio,
    0,
  ] as const;
}

function getCameraPosition(
  bounds: ReturnType<typeof createBounds>,
  target: readonly [number, number, number]
) {
  return [
    target[0] + bounds.span * CAMERA_COMPOSITION.horizontalRatio,
    bounds.span * CAMERA_COMPOSITION.verticalRatio,
    bounds.span * CAMERA_COMPOSITION.depthRatio,
  ] as const;
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function getMotionCenterX(forwardDistance: number) {
  return (
    forwardDistance *
    VELOCITY_SPEED_SCENE.worldScale *
    VELOCITY_SPEED_SCENE.motionCenterRatio
  );
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatSignedNumber(value: number) {
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
}

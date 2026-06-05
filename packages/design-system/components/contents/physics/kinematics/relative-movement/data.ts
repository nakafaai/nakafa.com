import type { ReactNode } from "react";

export const RELATIVE_MOVEMENT_OBSERVER_CAR_MODEL_PATH =
  "/models/physics/kinematics/kenney-car-kit/hatchback-sports.glb";

export const RELATIVE_MOVEMENT_TARGET_CAR_MODEL_PATH =
  "/models/physics/kinematics/kenney-car-kit/race.glb";

export const RELATIVE_MOVEMENT_CASE_IDS = [
  "same-direction",
  "opposite-direction",
] as const;

export type RelativeMovementCaseId =
  (typeof RELATIVE_MOVEMENT_CASE_IDS)[number];

export interface RelativeMovementLabLabels {
  chooseCase: string;
  directionLabels: Record<"left" | "right", ReactNode>;
  factLabels: {
    observer: ReactNode;
    relativeVelocity: ReactNode;
    target: ReactNode;
    visibleDirection: ReactNode;
  };
  modeLabels: Record<RelativeMovementCaseId, ReactNode>;
  viewLabel: string;
}

export interface RelativeMovementLabProps {
  description: ReactNode;
  labels: RelativeMovementLabLabels;
  title: ReactNode;
}

const RELATIVE_MOVEMENT_CASES: Record<
  RelativeMovementCaseId,
  {
    observerSpeed: number;
    targetSpeed: number;
  }
> = {
  "opposite-direction": {
    observerSpeed: 12,
    targetSpeed: -12,
  },
  "same-direction": {
    observerSpeed: 10,
    targetSpeed: 24,
  },
};

export const RELATIVE_MOVEMENT_CAMERA = {
  cameraPosition: [4.8, 3.3, 6.4],
  cameraTarget: [0, 0.16, 0],
} satisfies Record<string, readonly [number, number, number]>;

export const RELATIVE_MOVEMENT_SCENE = {
  carTravelRange: 10.8,
  laneOffset: 0.74,
  oppositeDirectionGap: 5.2,
  relativeGap: 2.2,
  roadLength: 52,
  roadWidth: 2.72,
  stripeSpacing: 1.2,
} as const;

export type RelativeMovementState = ReturnType<typeof getRelativeMovementState>;

export function getRelativeMovementState(caseId: RelativeMovementCaseId) {
  const motionCase = RELATIVE_MOVEMENT_CASES[caseId];
  const relativeVelocity = motionCase.targetSpeed - motionCase.observerSpeed;
  const targetHeading = getSignDirection(motionCase.targetSpeed);
  const relativeDirection = getSignDirection(relativeVelocity);

  return {
    caseId,
    observerSpeed: motionCase.observerSpeed,
    relativeDirection,
    relativeVelocity,
    targetHeading,
    targetSpeed: motionCase.targetSpeed,
  };
}

export function isRelativeMovementCaseId(
  value: string
): value is RelativeMovementCaseId {
  return RELATIVE_MOVEMENT_CASE_IDS.some((caseId) => caseId === value);
}

export function formatSignedSpeedMath(value: number) {
  const sign = value > 0 ? "+" : "";

  return `${sign}${Math.round(value)}\\text{ m/s}`;
}

function getSignDirection(value: number): "left" | "right" {
  return value < 0 ? "left" : "right";
}

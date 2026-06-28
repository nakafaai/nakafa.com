import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

export const UNIFORM_CIRCULAR_MOTION_CAR_MODEL_PATH =
  "/models/physics/kinematics/kenney-car-kit/race.glb";

export const UNIFORM_CIRCULAR_MOTION_COLORS = {
  carBody: getColor("ORANGE", 500),
} as const;

export const UNIFORM_CIRCULAR_MOTION_PERIODS = [8, 6, 4] as const;

export type UniformCircularMotionPeriod =
  (typeof UNIFORM_CIRCULAR_MOTION_PERIODS)[number];

export type UniformCircularMotionDecimalSeparator = "comma" | "dot";

export interface UniformCircularMotionLabLabels {
  acceleration: ReactNode;
  choosePeriod: string;
  period: ReactNode;
  radius: ReactNode;
  speed: ReactNode;
  viewLabel: string;
}

export interface UniformCircularMotionLabProps {
  decimalSeparator?: UniformCircularMotionDecimalSeparator;
  description: ReactNode;
  labels: UniformCircularMotionLabLabels;
  title: ReactNode;
}

const TRACK_RADIUS = 4;

export const UNIFORM_CIRCULAR_MOTION_SCENE = {
  carScale: 0.84,
  innerRadius: 3.45,
  laneMarkerCount: 18,
  outerRadius: 4.55,
  radius: TRACK_RADIUS,
} as const;

export const UNIFORM_CIRCULAR_MOTION_CAMERA = {
  cameraPosition: [6.1, 8.6, 7.2],
  cameraTarget: [0, 0, 0],
} satisfies Record<string, readonly [number, number, number]>;

export type UniformCircularMotionState = ReturnType<
  typeof getUniformCircularMotionState
>;

export function getUniformCircularMotionState(
  period: UniformCircularMotionPeriod
) {
  const angularSpeed = (2 * Math.PI) / period;
  const speed = angularSpeed * TRACK_RADIUS;
  const acceleration = speed ** 2 / TRACK_RADIUS;

  return {
    acceleration,
    angularSpeed,
    period,
    radius: TRACK_RADIUS,
    speed,
  };
}

export function isUniformCircularMotionPeriod(
  value: number
): value is UniformCircularMotionPeriod {
  return UNIFORM_CIRCULAR_MOTION_PERIODS.some((period) => period === value);
}

export function formatCircularMotionDecimal(
  value: number,
  decimalSeparator?: UniformCircularMotionDecimalSeparator
) {
  const rounded = value.toFixed(2);

  if (decimalSeparator === "comma") {
    return rounded.replace(".", "{,}");
  }

  return rounded;
}

export function formatPeriodMath(value: number) {
  return `${Math.round(value)}\\text{ s}`;
}

export function formatRadiusMath(value: number) {
  return `${Math.round(value)}\\text{ m}`;
}

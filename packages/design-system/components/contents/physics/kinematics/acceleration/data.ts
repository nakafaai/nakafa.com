import { getColor } from "@repo/design-system/lib/color";

export type AccelerationCaseId = "speed-up" | "steady" | "slow-down";

export interface AccelerationCase {
  color: string;
  id: AccelerationCaseId;
  t0: number;
  t1: number;
  v0: number;
  v1: number;
}

export interface AccelerationLabels {
  chooseCase: string;
  scenarioNames: Record<AccelerationCaseId, string>;
  timeAxis: string;
  velocityAxis: string;
}

export const DEFAULT_ACCELERATION_CASE_ID =
  "speed-up" satisfies AccelerationCaseId;

export const ACCELERATION_CASES: AccelerationCase[] = [
  {
    id: "speed-up",
    color: getColor("TEAL"),
    t0: 0,
    t1: 4,
    v0: 2,
    v1: 10,
  },
  {
    id: "steady",
    color: getColor("SKY"),
    t0: 4,
    t1: 8,
    v0: 10,
    v1: 10,
  },
  {
    id: "slow-down",
    color: getColor("VIOLET"),
    t0: 8,
    t1: 12,
    v0: 10,
    v1: 2,
  },
];

export function getAccelerationCaseById(id: AccelerationCaseId) {
  return (
    ACCELERATION_CASES.find((item) => item.id === id) ?? ACCELERATION_CASES[0]
  );
}

export function isAccelerationCaseId(
  value: string
): value is AccelerationCaseId {
  return ACCELERATION_CASES.some((item) => item.id === value);
}

export function getDeltaVelocity(item: AccelerationCase) {
  return item.v1 - item.v0;
}

export function getMotionPoints() {
  const firstCase = ACCELERATION_CASES[0];

  return [
    { time: firstCase.t0, velocity: firstCase.v0 },
    ...ACCELERATION_CASES.map((item) => ({
      time: item.t1,
      velocity: item.v1,
    })),
  ];
}

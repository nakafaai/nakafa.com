import { getColor } from "@repo/design-system/lib/color";

export type InstantaneousVelocitySpeedLocale = "id" | "en";

export const INSTANTANEOUS_SPEED_CAR_MODEL_PATH =
  "/models/physics/kinematics/kenney-car-kit/suv-luxury.glb";

export const INSTANTANEOUS_SPEED_CASES = [
  {
    direction: 1,
    id: "right-fast",
    speed: 20,
    time: 6,
  },
  {
    direction: -1,
    id: "left-slow",
    speed: 8,
    time: 9,
  },
] as const;

export type InstantaneousSpeedCaseId =
  (typeof INSTANTANEOUS_SPEED_CASES)[number]["id"];

export const DEFAULT_INSTANTANEOUS_SPEED_CASE_ID =
  "right-fast" satisfies InstantaneousSpeedCaseId;

export const INSTANTANEOUS_SPEED_SCENE = {
  carScale: 0.7,
  detectorHeight: 0.46,
  detectorPostRadius: 0.045,
  detectorStripWidth: 0.08,
  pauseSeconds: 0.55,
  readingDistanceMeters: 44,
  roadMinimumLength: 42,
  roadWidth: 1.8,
  stripeLength: 0.44,
  stripeSpacing: 1.5,
  stripeWidth: 0.06,
  trackZ: 0.18,
  worldScale: 0.12,
} as const;

export const INSTANTANEOUS_SPEED_CAMERA = {
  cameraPosition: [4.8, 3.15, 6.2],
  cameraTarget: [0, 0.18, 0],
  fov: 42,
} satisfies {
  cameraPosition: readonly [number, number, number];
  cameraTarget: readonly [number, number, number];
  fov: number;
};

export const INSTANTANEOUS_SPEED_COLORS = {
  car: getColor("BLUE"),
  detector: getColor("TEAL"),
  detectorBase: "#0f766e",
  road: "#1f2937",
  stripe: "#f8fafc",
} as const;

export const INSTANTANEOUS_SPEED_COPY = {
  id: {
    chooseMoment: "Pilih momen baca",
    description:
      "Pilih momen baca untuk melihat mobil melewati titik ukur dan nilai kecepatan sesaatnya.",
    factLabels: {
      speed: "Kelajuan sesaat",
      time: "Waktu baca",
      velocity: "Kecepatan sesaat",
    },
    title: "Bacaan di Titik Ukur",
    viewLabel: "Tampilan 3D mobil melewati titik ukur",
  },
  en: {
    chooseMoment: "Choose reading moment",
    description:
      "Choose a reading moment to see the car pass a measuring point and its instantaneous velocity value.",
    factLabels: {
      speed: "Instantaneous speed",
      time: "Reading time",
      velocity: "Instantaneous velocity",
    },
    title: "Reading at a Measuring Point",
    viewLabel: "3D car passing a measuring point",
  },
} as const;

export type InstantaneousVelocitySpeedState = ReturnType<
  typeof getInstantaneousVelocitySpeedState
>;

export function getInstantaneousVelocitySpeedState(
  id: InstantaneousSpeedCaseId
) {
  const scenario = getInstantaneousSpeedCaseById(id);
  const velocity = scenario.speed * scenario.direction;
  const halfTravelLength =
    INSTANTANEOUS_SPEED_SCENE.readingDistanceMeters *
    INSTANTANEOUS_SPEED_SCENE.worldScale;
  const trackLength = halfTravelLength * 2;
  const startX = -scenario.direction * halfTravelLength;
  const endX = scenario.direction * halfTravelLength;
  const loopSeconds =
    (INSTANTANEOUS_SPEED_SCENE.readingDistanceMeters * 2) / scenario.speed;
  const measurementX = 0;
  const roadLength = getRoadLength(trackLength);

  return {
    endX,
    loopSeconds,
    measurementX,
    roadLength,
    scenario,
    startX,
    velocity,
  };
}

export function isInstantaneousSpeedCaseId(
  value: string
): value is InstantaneousSpeedCaseId {
  return INSTANTANEOUS_SPEED_CASES.some((scenario) => scenario.id === value);
}

export function formatSignedSpeedMath(value: number) {
  return `${formatSignedNumber(value)}\\text{ m/s}`;
}

export function formatSpeedMath(value: number) {
  return `${Math.round(value)}\\text{ m/s}`;
}

export function formatTimeMath(value: number) {
  return `${Math.round(value)}\\text{ s}`;
}

function getInstantaneousSpeedCaseById(id: InstantaneousSpeedCaseId) {
  return (
    INSTANTANEOUS_SPEED_CASES.find((scenario) => scenario.id === id) ??
    INSTANTANEOUS_SPEED_CASES[0]
  );
}

function getRoadLength(trackLength: number) {
  return Math.max(INSTANTANEOUS_SPEED_SCENE.roadMinimumLength, trackLength * 4);
}

function formatSignedNumber(value: number) {
  if (value === 0) {
    return "0";
  }

  if (value > 0) {
    return `+${Math.round(value)}`;
  }

  return `${Math.round(value)}`;
}

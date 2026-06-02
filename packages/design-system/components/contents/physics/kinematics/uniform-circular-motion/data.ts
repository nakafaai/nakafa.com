export const UNIFORM_CIRCULAR_MOTION_CAR_MODEL_PATH =
  "/models/physics/kinematics/kenney-car-kit/sedan-sports.glb";

export const UNIFORM_CIRCULAR_MOTION_PERIODS = [8, 6, 4] as const;

export type UniformCircularMotionPeriod =
  (typeof UNIFORM_CIRCULAR_MOTION_PERIODS)[number];

export type UniformCircularMotionLocale = "id" | "en";

const TRACK_RADIUS = 4;

export const UNIFORM_CIRCULAR_MOTION_SCENE = {
  carScale: 0.58,
  innerRadius: 3.45,
  laneMarkerCount: 18,
  outerRadius: 4.55,
  radius: TRACK_RADIUS,
} as const;

export const UNIFORM_CIRCULAR_MOTION_CAMERA = {
  cameraPosition: [6.1, 8.6, 7.2],
  cameraTarget: [0, 0, 0],
} satisfies Record<string, readonly [number, number, number]>;

export const UNIFORM_CIRCULAR_MOTION_COPY = {
  id: {
    acceleration: "Percepatan sentripetal",
    choosePeriod: "Pilih periode",
    description:
      "Ubah periode untuk melihat mobil menyelesaikan putaran dengan kelajuan yang berbeda.",
    period: "Periode",
    radius: "Jari-jari",
    speed: "Kelajuan",
    title: "Mobil di Lintasan Melingkar",
    viewLabel: "Mobil pada lintasan gerak melingkar beraturan",
  },
  en: {
    acceleration: "Centripetal acceleration",
    choosePeriod: "Choose period",
    description:
      "Change the period to see the car complete each lap at a different speed.",
    period: "Period",
    radius: "Radius",
    speed: "Speed",
    title: "Car on a Circular Track",
    viewLabel: "Car moving in uniform circular motion",
  },
} as const;

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
  locale: UniformCircularMotionLocale
) {
  const rounded = value.toFixed(2);

  if (locale === "id") {
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

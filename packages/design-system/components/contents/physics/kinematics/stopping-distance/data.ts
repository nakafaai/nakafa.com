export const STOPPING_DISTANCE_CAR_MODEL_PATH =
  "/models/physics/kinematics/kenney-car-kit/sedan-sports.glb";

export const STOPPING_DISTANCE_SPEEDS = [10, 20, 30] as const;

export type StoppingDistanceSpeed = (typeof STOPPING_DISTANCE_SPEEDS)[number];

export type StoppingDistanceLocale = "id" | "en";

export const STOPPING_DISTANCE_REACTION_TIME = 1;
export const STOPPING_DISTANCE_BRAKING_DECELERATION = 5;

const MAX_STOPPING_DISTANCE = 120;
const WORLD_TRACK_LENGTH = 11.2;
const WORLD_START_X = 0;
const WORLD_SCALE = WORLD_TRACK_LENGTH / MAX_STOPPING_DISTANCE;
const WORLD_ROAD_MARGIN = WORLD_TRACK_LENGTH * 0.65;
const WORLD_MAX_STOP_X = WORLD_START_X + MAX_STOPPING_DISTANCE * WORLD_SCALE;

export const STOPPING_DISTANCE_CAMERA = {
  cameraPosition: [4.1, 3.4, 9.2],
  cameraTarget: [0, 0.08, 0],
} satisfies Record<string, readonly [number, number, number]>;

export const STOPPING_DISTANCE_SCENE = {
  startX: WORLD_START_X,
  roadCenterX: (WORLD_START_X + WORLD_MAX_STOP_X) / 2,
  roadLength: WORLD_MAX_STOP_X - WORLD_START_X + WORLD_ROAD_MARGIN * 2,
  roadWidth: 1.9,
  worldScale: WORLD_SCALE,
} as const;

export const STOPPING_DISTANCE_COPY = {
  id: {
    brakingDistance: "Jarak pengereman",
    chooseSpeed: "Pilih kecepatan awal",
    description:
      "Ubah kecepatan awal untuk melihat jarak reaksi hijau dan jarak pengereman oranye.",
    reactionDistance: "Jarak reaksi",
    speed: "Kecepatan awal",
    stoppingDistance: "Jarak henti",
    title: "Jarak Henti Mobil",
    viewLabel: "Tampilan 3D jarak henti mobil",
  },
  en: {
    brakingDistance: "Braking distance",
    chooseSpeed: "Choose initial speed",
    description:
      "Change the initial speed to compare green reaction distance with orange braking distance.",
    reactionDistance: "Reaction distance",
    speed: "Initial speed",
    stoppingDistance: "Stopping distance",
    title: "Car Stopping Distance",
    viewLabel: "3D car stopping distance view",
  },
} as const;

export type StoppingDistanceState = ReturnType<typeof getStoppingDistanceState>;

export function getStoppingDistanceState(speed: StoppingDistanceSpeed) {
  const reactionDistance = speed * STOPPING_DISTANCE_REACTION_TIME;
  const brakingDistance =
    speed ** 2 / (2 * STOPPING_DISTANCE_BRAKING_DECELERATION);
  const stoppingDistance = reactionDistance + brakingDistance;
  const reactionEndX = WORLD_START_X + reactionDistance * WORLD_SCALE;
  const stopX = WORLD_START_X + stoppingDistance * WORLD_SCALE;

  return {
    brakingDistance,
    reactionDistance,
    reactionEndX,
    speed,
    startX: WORLD_START_X,
    stoppingDistance,
    stopX,
  };
}

export function isStoppingDistanceSpeed(
  value: number
): value is StoppingDistanceSpeed {
  return STOPPING_DISTANCE_SPEEDS.some((speed) => speed === value);
}

export function formatMeterMath(value: number) {
  return `${Math.round(value)}\\text{ m}`;
}

export function formatSpeedMath(value: number) {
  return `${Math.round(value)}\\text{ m/s}`;
}

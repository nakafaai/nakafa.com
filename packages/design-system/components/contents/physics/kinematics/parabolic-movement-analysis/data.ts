import { getColor } from "@repo/design-system/lib/color";

export type ProjectileAnalysisLocale = "id" | "en";
export type ProjectileScenarioId = "sixty-degree" | "long-drive" | "high-arc";

export interface ProjectileScenario {
  angleDegrees: number;
  color: string;
  id: ProjectileScenarioId;
  initialSpeed: number;
}

export const PROJECTILE_GRAVITY = 10;
export const DEFAULT_PROJECTILE_SCENARIO_ID =
  "sixty-degree" satisfies ProjectileScenarioId;

export const PROJECTILE_ASSET_PATHS = {
  ball: "/models/physics/kinematics/kenney-pirate-kit/cannon-ball.glb",
  cannon: "/models/physics/kinematics/kenney-pirate-kit/cannon-mobile.glb",
  flag: "/models/physics/kinematics/kenney-pirate-kit/flag-pirate-high.glb",
  palm: "/models/physics/kinematics/kenney-pirate-kit/palm-bend.glb",
  rock: "/models/physics/kinematics/kenney-pirate-kit/rocks-sand-a.glb",
  sand: "/models/physics/kinematics/kenney-pirate-kit/patch-sand.glb",
  sandFoliage:
    "/models/physics/kinematics/kenney-pirate-kit/patch-sand-foliage.glb",
  ship: "/models/physics/kinematics/kenney-pirate-kit/ship-pirate-small.glb",
} as const;

export const PROJECTILE_SCENE = {
  animationSeconds: 4.2,
  ballScale: 0.34,
  cameraFov: 39,
  cameraPosition: [-6.3, 3.25, 8.8],
  cameraTarget: [2.7, 0.78, -0.22],
  cannonRotationY: Math.PI / 2,
  cannonScale: 0.72,
  ghostCount: 8,
  launchOffset: [0.72, 0.8, 0] as const,
  maxDistance: 16,
  minDistance: 3.2,
  pauseSeconds: 0.9,
  shipOffset: [-2.0, -0.035, -2.18] as const,
  shipScale: 0.42,
  trailSampleCount: 54,
  worldScale: 0.055,
} as const;

export const PROJECTILE_INSTANT_TIME = 2;

export const PROJECTILE_SCENARIOS: ProjectileScenario[] = [
  {
    id: "sixty-degree",
    angleDegrees: 60,
    color: getColor("TEAL"),
    initialSpeed: 40,
  },
  {
    id: "long-drive",
    angleDegrees: 35,
    color: getColor("ORANGE", 500),
    initialSpeed: 42,
  },
  {
    id: "high-arc",
    angleDegrees: 70,
    color: getColor("VIOLET"),
    initialSpeed: 34,
  },
];

export const PROJECTILE_ANALYSIS_COPY = {
  en: {
    chooseScenario: "Choose launch",
    description:
      "A cannonball crosses the water while the ghost balls mark equal time steps from the same formulas used in the calculation.",
    factLabels: {
      flightTime: "Flight time",
      horizontalComponent: "Horizontal component",
      instantaneousVelocity: "Velocity at two seconds",
      peakTime: "Peak time",
      range: "Range",
      verticalComponent: "Vertical component",
    },
    scenarioNames: {
      "high-arc": "High Arc",
      "long-drive": "Long Drive",
      "sixty-degree": "Sixty Degrees",
    },
    title: "Cannonball Component Analysis",
    viewLabel: "Cannonball projectile analysis view",
  },
  id: {
    chooseScenario: "Pilih tembakan",
    description:
      "Bola meriam melintas di atas air, sementara bayangan bolanya menandai selang waktu yang sama dari rumus yang dipakai dalam hitungan.",
    factLabels: {
      flightTime: "Waktu terbang",
      horizontalComponent: "Komponen mendatar",
      instantaneousVelocity: "Kecepatan pada dua detik",
      peakTime: "Waktu puncak",
      range: "Jangkauan",
      verticalComponent: "Komponen vertikal",
    },
    scenarioNames: {
      "high-arc": "Lengkung Tinggi",
      "long-drive": "Jarak Jauh",
      "sixty-degree": "Enam Puluh Derajat",
    },
    title: "Analisis Komponen Bola Meriam",
    viewLabel: "Tampilan analisis gerak parabola bola meriam",
  },
} as const;

const TRAILING_ZERO_DECIMAL_REGEX = /\.0$/;

export type ProjectileMotionState = ReturnType<typeof getProjectileMotionState>;

export function isProjectileScenarioId(
  value: string
): value is ProjectileScenarioId {
  return PROJECTILE_SCENARIOS.some((scenario) => scenario.id === value);
}

export function getProjectileMotionState(id: ProjectileScenarioId) {
  const scenario =
    PROJECTILE_SCENARIOS.find((item) => item.id === id) ??
    PROJECTILE_SCENARIOS[0];
  const angleRadians = (scenario.angleDegrees * Math.PI) / 180;
  const horizontalVelocity = scenario.initialSpeed * Math.cos(angleRadians);
  const verticalVelocity = scenario.initialSpeed * Math.sin(angleRadians);
  const peakTime = verticalVelocity / PROJECTILE_GRAVITY;
  const flightTime = 2 * peakTime;
  const range = horizontalVelocity * flightTime;
  const peakHeight = verticalVelocity ** 2 / (2 * PROJECTILE_GRAVITY);
  const rangeWorld = range * PROJECTILE_SCENE.worldScale;
  const peakWorld = peakHeight * PROJECTILE_SCENE.worldScale;
  const ghostTimes = Array.from(
    { length: PROJECTILE_SCENE.ghostCount },
    (_, index) => (flightTime * index) / (PROJECTILE_SCENE.ghostCount - 1)
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

export function getProjectilePoint(
  motion: ProjectileMotionState,
  time: number
) {
  const safeTime = clamp(time, 0, motion.flightTime);
  const xMeters = motion.horizontalVelocity * safeTime;
  const yMeters =
    motion.verticalVelocity * safeTime -
    (PROJECTILE_GRAVITY * safeTime ** 2) / 2;

  return {
    time: safeTime,
    x: xMeters * PROJECTILE_SCENE.worldScale,
    xMeters,
    y: yMeters * PROJECTILE_SCENE.worldScale,
    yMeters,
  };
}

export function getVelocityAtTime(motion: ProjectileMotionState, time: number) {
  const safeTime = clamp(time, 0, motion.flightTime);
  const verticalVelocity =
    motion.verticalVelocity - PROJECTILE_GRAVITY * safeTime;

  return {
    horizontalVelocity: motion.horizontalVelocity,
    speed: Math.hypot(motion.horizontalVelocity, verticalVelocity),
    verticalVelocity,
  };
}

export function getProjectileLoopSample(
  motion: ProjectileMotionState,
  elapsed: number
) {
  const cycleSeconds =
    PROJECTILE_SCENE.animationSeconds + PROJECTILE_SCENE.pauseSeconds;
  const cycleTime = elapsed % cycleSeconds;
  const progress = Math.min(cycleTime / PROJECTILE_SCENE.animationSeconds, 1);
  const time = motion.flightTime * progress;

  return {
    flashPower: getMuzzleFlashPower(cycleTime),
    point: getProjectilePoint(motion, time),
    progress,
    time,
  };
}

export function formatMeterMath(
  value: number,
  locale: ProjectileAnalysisLocale
) {
  return `${formatNumber(value, locale)}\\text{ m}`;
}

export function formatSecondMath(
  value: number,
  locale: ProjectileAnalysisLocale
) {
  return `${formatNumber(value, locale)}\\text{ s}`;
}

export function formatSpeedMath(
  value: number,
  locale: ProjectileAnalysisLocale
) {
  return `${formatNumber(value, locale)}\\text{ m/s}`;
}

export function formatVelocityVectorMath(
  horizontalVelocity: number,
  verticalVelocity: number,
  locale: ProjectileAnalysisLocale
) {
  const horizontal = formatNumber(horizontalVelocity, locale);
  const vertical = formatNumber(verticalVelocity, locale);

  return `\\langle ${horizontal}, ${vertical}\\rangle\\text{ m/s}`;
}

function getMuzzleFlashPower(cycleTime: number) {
  const flashSeconds = 0.42;

  if (cycleTime >= flashSeconds) {
    return 0;
  }

  return 1 - cycleTime / flashSeconds;
}

function formatNumber(value: number, locale: ProjectileAnalysisLocale) {
  const rounded = value.toFixed(1).replace(TRAILING_ZERO_DECIMAL_REGEX, "");

  if (locale === "id") {
    return rounded.replace(".", "{,}");
  }

  return rounded;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

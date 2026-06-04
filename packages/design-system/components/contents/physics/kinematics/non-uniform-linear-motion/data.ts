import { getColor } from "@repo/design-system/lib/color";

export type GlbbScenarioId = "from-rest" | "speed-up" | "brake";
export type GlbbLocale = "id" | "en";

export interface GlbbScenario {
  acceleration: number;
  color: string;
  duration: number;
  id: GlbbScenarioId;
  initialVelocity: number;
}

export interface GlbbLabels {
  chooseScenario: string;
  scenarioNames: Record<GlbbScenarioId, string>;
  timeAxis: string;
  velocityAxis: string;
}

export const GLBB_TRAIN_MODEL_PATH =
  "/models/physics/kinematics/kenney-train-kit/train-electric-bullet-a.glb";

export const GLBB_COLORS = {
  trainBody: getColor("ROSE"),
} as const;

export const DEFAULT_GLBB_SCENARIO_ID = "from-rest" satisfies GlbbScenarioId;

export const GLBB_SCENE = {
  animationSeconds: 4.2,
  cameraFov: 44,
  cameraPosition: [6.4, 6.2, 6.1],
  cameraTarget: [0, 0.08, 0],
  markerHeight: 0.05,
  markerRadius: 0.11,
  markerSideOffset: -0.44,
  motionEndClearanceRatio: 0.22,
  railGap: 0.58,
  railHeight: 0.05,
  railWidth: 0.05,
  sleeperHeight: 0.06,
  sleeperLength: 1.14,
  sleeperSpacing: 0.62,
  sleeperWidth: 0.11,
  trackMinimumLength: 92,
  trackPadding: 42,
  trackWidth: 1.28,
  trainScale: 0.64,
  worldScale: 0.16,
} as const;

export const GLBB_SCENARIOS: GlbbScenario[] = [
  {
    id: "from-rest",
    color: getColor("TEAL"),
    initialVelocity: 0,
    acceleration: 4,
    duration: 5,
  },
  {
    id: "speed-up",
    color: getColor("SKY"),
    initialVelocity: 8,
    acceleration: 4,
    duration: 4,
  },
  {
    id: "brake",
    color: getColor("VIOLET"),
    initialVelocity: 24,
    acceleration: -4,
    duration: 5,
  },
];

export const GLBB_LAB_COPY = {
  en: {
    chooseScenario: "Choose motion",
    description:
      "Marks on the rail show the train position every 1 s while acceleration stays constant.",
    factLabels: {
      acceleration: "Acceleration",
      displacement: "Displacement",
      finalVelocity: "Final velocity",
      initialVelocity: "Initial velocity",
    },
    scenarioNames: {
      brake: "Braking",
      "from-rest": "From Rest",
      "speed-up": "Speeding Up",
    },
    title: "Position Marks on a Rail",
    viewLabel: "3D uniformly accelerated motion view",
  },
  id: {
    chooseScenario: "Pilih gerak",
    description:
      "Titik di rel menandai posisi kereta setiap 1 s saat percepatan tetap.",
    factLabels: {
      acceleration: "Percepatan",
      displacement: "Perpindahan",
      finalVelocity: "Kecepatan akhir",
      initialVelocity: "Kecepatan awal",
    },
    scenarioNames: {
      brake: "Direm",
      "from-rest": "Dari Diam",
      "speed-up": "Makin Cepat",
    },
    title: "Jejak GLBB pada Rel",
    viewLabel: "Tampilan 3D gerak lurus berubah beraturan",
  },
} as const;

const TRAILING_ZERO_DECIMAL_REGEX = /\.0$/;

export function getGlbbScenarioById(id: GlbbScenarioId) {
  return (
    GLBB_SCENARIOS.find((scenario) => scenario.id === id) ?? GLBB_SCENARIOS[0]
  );
}

export function isGlbbScenarioId(value: string): value is GlbbScenarioId {
  return GLBB_SCENARIOS.some((scenario) => scenario.id === value);
}

export function getFinalVelocity(scenario: GlbbScenario) {
  return getVelocityAt(scenario, scenario.duration);
}

export type GlbbMotionState = ReturnType<typeof getGlbbMotionState>;

export function getGlbbMotionState(id: GlbbScenarioId) {
  const scenario = getGlbbScenarioById(id);
  const displacement = getDisplacementAt(scenario, scenario.duration);
  const worldDisplacement = displacement * GLBB_SCENE.worldScale;
  const trainStartX = getTrainStartX(worldDisplacement);
  const trackLength = getTrackLength(worldDisplacement);
  const timeSamples = getTimeSamples(scenario.duration);
  const positionSamples = timeSamples.map((time) =>
    getGlbbPositionSample(scenario, time, trainStartX)
  );

  return {
    displacement,
    finalVelocity: getFinalVelocity(scenario),
    positionSamples,
    scenario,
    trackLength,
    trainStartX,
    worldDisplacement,
  };
}

function getTrainStartX(worldDisplacement: number) {
  const endClearanceOffset =
    worldDisplacement * GLBB_SCENE.motionEndClearanceRatio;

  return -(worldDisplacement / 2) - endClearanceOffset;
}

function getTrackLength(worldDisplacement: number) {
  const contextualLength = worldDisplacement + GLBB_SCENE.trackPadding * 2;

  return Math.max(GLBB_SCENE.trackMinimumLength, contextualLength);
}

export function getGlbbPositionSample(
  scenario: GlbbScenario,
  time: number,
  trainStartX: number
) {
  const safeTime = clamp(time, 0, scenario.duration);
  const displacement = getDisplacementAt(scenario, safeTime);

  return {
    displacement,
    time: safeTime,
    velocity: getVelocityAt(scenario, safeTime),
    x: trainStartX + displacement * GLBB_SCENE.worldScale,
  };
}

export function getGlbbLoopTime(state: GlbbMotionState, elapsed: number) {
  const cycleSeconds = GLBB_SCENE.animationSeconds + 0.8;
  const cycleTime = elapsed % cycleSeconds;
  const progress = Math.min(cycleTime / GLBB_SCENE.animationSeconds, 1);

  return progress * state.scenario.duration;
}

export function getVelocityAt(scenario: GlbbScenario, time: number) {
  return scenario.initialVelocity + scenario.acceleration * time;
}

export function getDisplacementAt(scenario: GlbbScenario, time: number) {
  return (
    scenario.initialVelocity * time + (scenario.acceleration * time ** 2) / 2
  );
}

export function formatAccelerationMath(value: number) {
  return `${formatSignedNumber(value)}\\text{ m/s}^2`;
}

export function formatMeterMath(value: number) {
  return `${formatNumber(value)}\\text{ m}`;
}

export function formatVelocityMath(value: number) {
  return `${formatSignedNumber(value)}\\text{ m/s}`;
}

function getTimeSamples(duration: number) {
  const wholeSecondCount = Math.floor(duration) + 1;
  const samples = Array.from({ length: wholeSecondCount }, (_, index) => index);
  const lastSample = samples.at(-1) ?? 0;

  if (lastSample === duration) {
    return samples;
  }

  return [...samples, duration];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatNumber(value: number) {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(1).replace(TRAILING_ZERO_DECIMAL_REGEX, "");
}

function formatSignedNumber(value: number) {
  if (value === 0) {
    return "0";
  }

  if (value > 0) {
    return `+${formatNumber(value)}`;
  }

  return formatNumber(value);
}

import { formatSignedTrimmedNumber } from "@repo/design-system/components/contents/physics/kinematics/number";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Number as Num, Option, Schema } from "effect";

const GlbbScenarioIdSchema = Schema.Literals([
  "from-rest",
  "speed-up",
  "brake",
]);

export type GlbbScenarioId = typeof GlbbScenarioIdSchema.Type;

const GlbbScenarioSchema = Schema.Struct({
  acceleration: Schema.Finite,
  color: Schema.String,
  duration: Schema.Finite,
  id: GlbbScenarioIdSchema,
  initialVelocity: Schema.Finite,
});

export type GlbbScenario = typeof GlbbScenarioSchema.Type;

const GlbbLabelsSchema = Schema.Struct({
  chooseScenario: Schema.String,
  scenarioNames: Schema.Record(GlbbScenarioIdSchema, Schema.String),
  timeAxis: Schema.String,
  velocityAxis: Schema.String,
});

export type GlbbLabels = typeof GlbbLabelsSchema.Type;

export const GLBB_COLORS = {
  trainBody: PLOT_COLORS.pink,
} as const;

export const DEFAULT_GLBB_SCENARIO_ID = "from-rest" satisfies GlbbScenarioId;

export const GLBB_SCENE = {
  animationSeconds: 4.2,
  cameraFov: 44,
  cameraPosition: [4.9, 2.3, 6.3],
  cameraTarget: [0, 0.08, 0],
  narrowCameraPosition: [6.9, 3.2, 8.8],
  markerHeight: 0.05,
  markerRadius: 0.11,
  markerSideOffset: 0.72,
  motionEndClearanceRatio: 0.22,
  railGap: 0.58,
  sleeperSpacing: 0.62,
  sleeperWidth: 0.11,
  worldScale: 0.16,
} as const;

export const GLBB_SCENARIOS: GlbbScenario[] = [
  {
    id: "from-rest",
    color: PLOT_COLORS.teal,
    initialVelocity: 0,
    acceleration: 4,
    duration: 5,
  },
  {
    id: "speed-up",
    color: PLOT_COLORS.slate,
    initialVelocity: 8,
    acceleration: 4,
    duration: 4,
  },
  {
    id: "brake",
    color: PLOT_COLORS.violet,
    initialVelocity: 24,
    acceleration: -4,
    duration: 5,
  },
];

export function getGlbbScenarioById(id: GlbbScenarioId) {
  return Option.getOrElse(
    Arr.findFirst(GLBB_SCENARIOS, (scenario) => scenario.id === id),
    () => GLBB_SCENARIOS[0]
  );
}

export function isGlbbScenarioId(value: string): value is GlbbScenarioId {
  return Arr.some(GLBB_SCENARIOS, (scenario) => scenario.id === value);
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
  const timeSamples = getTimeSamples(scenario.duration);
  const positionSamples = Arr.map(timeSamples, (time) =>
    getGlbbPositionSample(scenario, time, trainStartX)
  );

  return {
    displacement,
    finalVelocity: getFinalVelocity(scenario),
    positionSamples,
    scenario,
    trainStartX,
    worldDisplacement,
  };
}

function getTrainStartX(worldDisplacement: number) {
  const endClearanceOffset =
    worldDisplacement * GLBB_SCENE.motionEndClearanceRatio;

  return -(worldDisplacement / 2) - endClearanceOffset;
}

export function getGlbbPositionSample(
  scenario: GlbbScenario,
  time: number,
  trainStartX: number
) {
  const safeTime = Num.clamp(time, { minimum: 0, maximum: scenario.duration });
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

function getVelocityAt(scenario: GlbbScenario, time: number) {
  return scenario.initialVelocity + scenario.acceleration * time;
}

function getDisplacementAt(scenario: GlbbScenario, time: number) {
  return (
    scenario.initialVelocity * time + (scenario.acceleration * time ** 2) / 2
  );
}

export function formatVelocityMath(value: number) {
  return `${formatSignedTrimmedNumber(value)}\\text{ m/s}`;
}

function getTimeSamples(duration: number) {
  const wholeSecondCount = Math.floor(duration) + 1;
  const samples = Array.from({ length: wholeSecondCount }, (_, index) => index);
  const lastSample = Option.getOrElse(Arr.last(samples), () => 0);

  if (lastSample === duration) {
    return samples;
  }

  return [...samples, duration];
}

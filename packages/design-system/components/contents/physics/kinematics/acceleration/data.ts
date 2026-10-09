import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr, Option, Schema } from "effect";

const AccelerationCaseIdSchema = Schema.Literals([
  "speed-up",
  "steady",
  "slow-down",
]);
export type AccelerationCaseId = typeof AccelerationCaseIdSchema.Type;

export const RocketExhaustSchema = Schema.Struct({
  anchor: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  radius: Schema.Finite,
});
export type RocketExhaust = typeof RocketExhaustSchema.Type;

const AccelerationCaseSchema = Schema.Struct({
  color: Schema.String,
  id: AccelerationCaseIdSchema,
  t0: Schema.Finite,
  t1: Schema.Finite,
  v0: Schema.Finite,
  v1: Schema.Finite,
});
export type AccelerationCase = typeof AccelerationCaseSchema.Type;

const MotionPointSchema = Schema.Struct({
  time: Schema.Finite,
  velocity: Schema.Finite,
});
type MotionPoint = typeof MotionPointSchema.Type;

const AccelerationLabelsSchema = Schema.Struct({
  chooseCase: Schema.String,
  contextLine: Schema.String,
  scenarioNames: Schema.Record(AccelerationCaseIdSchema, Schema.String),
  timeAxis: Schema.String,
  velocityAxis: Schema.String,
});
export type AccelerationLabels = typeof AccelerationLabelsSchema.Type;

export const ACCELERATION_ROCKET_MODEL_PATH =
  "/models/physics/kinematics/nasa-pegasus-xl/pegasus-xl-textureless.glb";

export const ACCELERATION_ROCKET_MOTION = {
  modelRotationY: Math.PI / 2,
  rollAmplitude: 0.018,
  rollFrequency: 2.4,
  rollPerAcceleration: -0.015,
  yawAmplitude: 0.025,
  yawFrequency: 1.8,
} as const;

const ACCELERATION_PROFILE = {
  accelerationMagnitude: 4,
  segmentSeconds: 4,
  startTime: 0,
  startVelocity: 2,
} as const;

export const ACCELERATION_LAB_SCENE = {
  animationSeconds: 3.2,
  cameraFov: 42,
  cameraPosition: [-2.8, 2.2, 8],
  cameraTarget: [0, 0, 0],
  gateRadius: 0.65,
  minSceneLength: 13.2,
  rocketScale: 0.3,
  scenePadding: 6,
  worldScale: 0.18,
} as const;

export const DEFAULT_ACCELERATION_CASE_ID =
  "speed-up" satisfies AccelerationCaseId;

const MOTION_START = {
  time: ACCELERATION_PROFILE.startTime,
  velocity: ACCELERATION_PROFILE.startVelocity,
};
const SPEED_UP_END = getMotionPointAfterAcceleration(
  MOTION_START,
  ACCELERATION_PROFILE.accelerationMagnitude
);
const STEADY_END = getMotionPointAfterAcceleration(SPEED_UP_END, 0);
const SLOW_DOWN_END = getMotionPointAfterAcceleration(
  STEADY_END,
  -ACCELERATION_PROFILE.accelerationMagnitude
);

export const ACCELERATION_CASES: AccelerationCase[] = [
  createAccelerationCase(
    "speed-up",
    getColor("TEAL"),
    MOTION_START,
    SPEED_UP_END
  ),
  createAccelerationCase("steady", getColor("SKY"), SPEED_UP_END, STEADY_END),
  createAccelerationCase(
    "slow-down",
    getColor("VIOLET"),
    STEADY_END,
    SLOW_DOWN_END
  ),
];

/** Creates one graph and lab scenario from calculated motion endpoints. */
function createAccelerationCase(
  id: AccelerationCaseId,
  color: string,
  start: MotionPoint,
  end: MotionPoint
) {
  return {
    color,
    id,
    t0: start.time,
    t1: end.time,
    v0: start.velocity,
    v1: end.velocity,
  };
}

/** Applies v = v0 + a * delta t for the next equal-duration segment. */
function getMotionPointAfterAcceleration(
  start: MotionPoint,
  acceleration: number
) {
  const duration = ACCELERATION_PROFILE.segmentSeconds;

  return {
    time: start.time + duration,
    velocity: start.velocity + acceleration * duration,
  };
}

export function getAccelerationCaseById(id: AccelerationCaseId) {
  return Option.getOrElse(
    Arr.findFirst(ACCELERATION_CASES, (item) => item.id === id),
    () => ACCELERATION_CASES[0]
  );
}

export function isAccelerationCaseId(
  value: string
): value is AccelerationCaseId {
  return Arr.some(ACCELERATION_CASES, (item) => item.id === value);
}

function getDeltaVelocity(item: AccelerationCase) {
  return item.v1 - item.v0;
}

export type AccelerationMotionState = ReturnType<
  typeof getAccelerationMotionState
>;

export function getAccelerationMotionState(id: AccelerationCaseId) {
  const scenario = getAccelerationCaseById(id);
  const duration = getAccelerationDuration(scenario);
  const displacement = getAccelerationDisplacementAt(scenario, duration);
  const worldDisplacement = displacement * ACCELERATION_LAB_SCENE.worldScale;
  const startX = -worldDisplacement / 2;
  const sceneLength = Math.max(
    worldDisplacement + ACCELERATION_LAB_SCENE.scenePadding,
    ACCELERATION_LAB_SCENE.minSceneLength
  );
  const samples = Arr.map(getTimeSamples(duration), (time) =>
    getAccelerationPositionSample(scenario, time, startX)
  );

  return {
    acceleration: getAccelerationValue(scenario),
    displacement,
    duration,
    samples,
    scenario,
    sceneLength,
    startX,
    worldDisplacement,
  };
}

export function getAccelerationLoopTime(
  state: AccelerationMotionState,
  elapsed: number
) {
  const cycleSeconds = ACCELERATION_LAB_SCENE.animationSeconds + 0.8;
  const cycleTime = elapsed % cycleSeconds;
  const progress = Math.min(
    cycleTime / ACCELERATION_LAB_SCENE.animationSeconds,
    1
  );

  return progress * state.duration;
}

export function getAccelerationPositionSample(
  scenario: AccelerationCase,
  time: number,
  startX: number
) {
  const safeTime = clamp(time, 0, getAccelerationDuration(scenario));
  const displacement = getAccelerationDisplacementAt(scenario, safeTime);

  return {
    displacement,
    time: safeTime,
    velocity: getAccelerationVelocityAt(scenario, safeTime),
    x: startX + displacement * ACCELERATION_LAB_SCENE.worldScale,
  };
}

function getAccelerationValue(item: AccelerationCase) {
  return getDeltaVelocity(item) / getAccelerationDuration(item);
}

function getAccelerationDuration(item: AccelerationCase) {
  return item.t1 - item.t0;
}

function getAccelerationVelocityAt(item: AccelerationCase, time: number) {
  return item.v0 + getAccelerationValue(item) * time;
}

function getMotionSegments() {
  return Arr.map(ACCELERATION_CASES, (item) => ({
    end: { time: item.t1, velocity: item.v1 },
    id: item.id,
    start: { time: item.t0, velocity: item.v0 },
  }));
}

/** Returns the connected velocity-time path shared by the graph tabs. */
export function getMotionPoints() {
  const segments = getMotionSegments();
  const firstSegment = segments[0];

  if (!firstSegment) {
    return [];
  }

  return [firstSegment.start, ...Arr.map(segments, (segment) => segment.end)];
}

export function formatAccelerationMath(value: number) {
  return `${formatSignedNumber(value)}\\text{ m/s}^2`;
}

export function formatMeterPerSecondMath(value: number) {
  return `${formatNumber(value)}\\text{ m/s}`;
}

export function formatSecondMath(value: number) {
  return `${formatNumber(value)}\\text{ s}`;
}

function getAccelerationDisplacementAt(item: AccelerationCase, time: number) {
  return item.v0 * time + (getAccelerationValue(item) * time ** 2) / 2;
}

function getTimeSamples(duration: number) {
  const sampleCount = Math.floor(duration) + 1;

  return Array.from({ length: sampleCount }, (_, index) => index);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const TRAILING_ZERO_DECIMAL_REGEX = /\.0$/;

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

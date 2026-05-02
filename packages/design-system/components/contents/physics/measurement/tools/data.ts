import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

export const LENGTH_TOOL_ID = "length";
export const MASS_TOOL_ID = "mass";
export const TIME_TOOL_ID = "time";
export const TRAILING_DECIMAL_ZERO_PATTERN = /\.?0+$/;

export const RULER_LENGTH_CM = 8;
export const RULER_DEFAULT_LENGTH_CM = 3.8;
export const RULER_START_X = -RULER_LENGTH_CM / 2;
export const RULER_MAJOR_TICK_COUNT = RULER_LENGTH_CM + 1;
export const RULER_MINOR_TICK_COUNT = RULER_LENGTH_CM * 5 + 1;
export const RULER_STEP_CM = 0.2;

export const MASS_MIN_GRAMS = 50;
export const MASS_REFERENCE_GRAMS = 250;
export const MASS_MAX_GRAMS = 500;
export const MASS_STEP_GRAMS = 10;
export const MASS_ARM_LENGTH = 1.7;
export const MASS_PIVOT_Y = 1.75;
export const MASS_PAN_DROP_Y = 0.7;
export const MASS_LOAD_BOTTOM_OFFSET_Y = 0.13;
export const MASS_WEIGHT_RADIUS = 0.38;
export const MASS_WEIGHT_TAPER_RATIO = 1.12;
export const MASS_WEIGHT_HEIGHT = 0.5;
export const MASS_BALANCE_MAX_TILT_RADIANS = Math.PI / 12;
export const MASS_BALANCE_STIFFNESS = 18;
export const MASS_BALANCE_DAMPING_RATIO = 0.75;
export const MASS_BALANCE_DAMPING =
  2 * Math.sqrt(MASS_BALANCE_STIFFNESS) * MASS_BALANCE_DAMPING_RATIO;
export const MASS_BALANCE_MAX_FRAME_DELTA = 1 / 30;
export const MASS_BALANCE_REST_EPSILON = 0.001;

export const STOPWATCH_READING_SECONDS = 12.8;
export const STOPWATCH_SECONDS_PER_ROTATION = 60;
export const STOPWATCH_STEP_SECONDS = 0.2;
export const STOPWATCH_HAND_LENGTH = 0.95;
export const STOPWATCH_HAND_CENTER = STOPWATCH_HAND_LENGTH / 2;

export const RULER_COLOR = getColor("AMBER");
export const OBJECT_COLOR = getColor("TEAL");
export const METAL_COLOR = getColor("SLATE");
export const MASS_COLOR = getColor("INDIGO");
export const TIME_COLOR = getColor("ROSE");
export const TIME_FACE_COLOR = getColor("YELLOW");
export const MASS_SCENE_SCALE = 1.1;
export const TIME_SCENE_SCALE = 0.95;

export type MeasurementToolId =
  | typeof LENGTH_TOOL_ID
  | typeof MASS_TOOL_ID
  | typeof TIME_TOOL_ID;
export type CameraPoint = readonly [number, number, number];

export const MEASUREMENT_CONTROLS = {
  [LENGTH_TOOL_ID]: {
    defaultValue: RULER_DEFAULT_LENGTH_CM,
    fractionDigits: 1,
    max: RULER_LENGTH_CM,
    min: RULER_STEP_CM,
    step: RULER_STEP_CM,
    unit: "cm",
  },
  [MASS_TOOL_ID]: {
    defaultValue: MASS_REFERENCE_GRAMS,
    fractionDigits: 0,
    max: MASS_MAX_GRAMS,
    min: MASS_MIN_GRAMS,
    step: MASS_STEP_GRAMS,
    unit: "g",
  },
  [TIME_TOOL_ID]: {
    defaultValue: STOPWATCH_READING_SECONDS,
    fractionDigits: 1,
    max: STOPWATCH_SECONDS_PER_ROTATION - STOPWATCH_STEP_SECONDS,
    min: 0,
    step: STOPWATCH_STEP_SECONDS,
    unit: "s",
  },
} satisfies Record<
  MeasurementToolId,
  {
    defaultValue: number;
    fractionDigits: number;
    max: number;
    min: number;
    step: number;
    unit: string;
  }
>;

export const TOOL_VIEW_CONFIG = {
  [LENGTH_TOOL_ID]: {
    cameraPosition: [0, 4.5, 8.5],
    cameraTarget: [0, 0.15, 0],
    narrowCameraPosition: [0, 5.1, 9.8],
  },
  [MASS_TOOL_ID]: {
    cameraPosition: [0, 3.1, 8],
    cameraTarget: [0, 0.85, 0],
    narrowCameraPosition: [0, 3.5, 9.2],
  },
  [TIME_TOOL_ID]: {
    cameraPosition: [0, 1.8, 7.4],
    cameraTarget: [0, 0.45, 0],
    narrowCameraPosition: [0, 2.1, 8.6],
  },
} satisfies Record<
  MeasurementToolId,
  {
    cameraPosition: CameraPoint;
    cameraTarget: CameraPoint;
    narrowCameraPosition: CameraPoint;
  }
>;

export interface ToolLabels {
  control: string;
  instrument: string;
  object: string;
  tab: string;
}

export interface MeasurementToolsLabLabels {
  chooseTool: string;
  decimalSeparator: "." | ",";
  instrument: string;
  measuredObject: string;
  reading: string;
  tools: Record<MeasurementToolId, ToolLabels>;
}

export interface MeasurementToolsLabProps {
  description: ReactNode;
  labels: MeasurementToolsLabLabels;
  title: ReactNode;
}

export interface MeasurementSceneProps {
  colors: SceneColors;
  measurement: number;
  reading: string;
}

export type MeasurementControl =
  (typeof MEASUREMENT_CONTROLS)[MeasurementToolId];
export type SceneColors = ReturnType<typeof getSceneColors>;

/**
 * Creates the initial value table from the same config used by the sliders.
 */
export function createInitialMeasurements() {
  return {
    [LENGTH_TOOL_ID]: MEASUREMENT_CONTROLS[LENGTH_TOOL_ID].defaultValue,
    [MASS_TOOL_ID]: MEASUREMENT_CONTROLS[MASS_TOOL_ID].defaultValue,
    [TIME_TOOL_ID]: MEASUREMENT_CONTROLS[TIME_TOOL_ID].defaultValue,
  };
}

/**
 * Chooses text and studio-light colors that remain legible in light and dark.
 */
export function getSceneColors(resolvedTheme: string | undefined) {
  const isDarkTheme = resolvedTheme === "dark";

  return {
    groundLight: isDarkTheme ? getColor("SLATE") : getColor("STONE"),
    skyLight: ORIGIN_COLOR.LIGHT,
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}

/**
 * Narrows ToggleGroup string values to the available measurement scenes.
 */
export function isMeasurementToolId(value: string): value is MeasurementToolId {
  return value in MEASUREMENT_CONTROLS;
}

/**
 * Snaps raw slider values to the configured measurement step.
 */
export function normalizeMeasurement(
  value: number,
  control: MeasurementControl
) {
  const steppedValue = Math.round(value / control.step) * control.step;
  const constrainedValue = Math.min(
    Math.max(steppedValue, control.min),
    control.max
  );

  return Number(constrainedValue.toFixed(control.fractionDigits));
}

/**
 * Formats one measurement for KaTeX and the 3D text labels.
 */
export function formatMeasurement(
  value: number,
  control: MeasurementControl,
  decimalSeparator: MeasurementToolsLabLabels["decimalSeparator"]
) {
  const formattedValue = formatMeasurementValue(
    value,
    control,
    decimalSeparator
  );

  return {
    math: `${formattedValue} \\text{ ${control.unit}}`,
    scene: `${formattedValue} ${control.unit}`,
  };
}

/**
 * Formats a measurement without adding meaningless trailing zeroes.
 */
function formatMeasurementValue(
  value: number,
  control: MeasurementControl,
  decimalSeparator: MeasurementToolsLabLabels["decimalSeparator"]
) {
  const fixedValue = value.toFixed(control.fractionDigits);
  const trimmedValue = fixedValue.includes(".")
    ? fixedValue.replace(TRAILING_DECIMAL_ZERO_PATTERN, "")
    : fixedValue;

  return trimmedValue.replace(".", decimalSeparator);
}

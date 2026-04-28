import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

export const LENGTH_MODE_ID = "length";
export const AREA_MODE_ID = "area";
export const VOLUME_MODE_ID = "volume";

export const BLOCK_WIDTH = 3;
export const BLOCK_HEIGHT = 1.4;
export const BLOCK_DEPTH = 1.4;
export const HIGHLIGHT_THICKNESS = 0.04;
export const CAMERA_POSITION = [3.6, 2.8, 4.4] satisfies readonly [
  number,
  number,
  number,
];
export const CAMERA_TARGET = [0, 0.45, 0] satisfies readonly [
  number,
  number,
  number,
];

// Drei Text renders plain strings, so WebGL labels avoid KaTeX syntax.
export const DIMENSION_MODES = {
  [LENGTH_MODE_ID]: {
    dimension: "[\\mathrm{L}]",
    formula: "s",
    powerLabel: "[L]",
    unit: "\\text{m}",
  },
  [AREA_MODE_ID]: {
    dimension: "[\\mathrm{L}]^2",
    formula: "A = p \\times l",
    powerLabel: "[L]^2",
    unit: "\\text{m}^2",
  },
  [VOLUME_MODE_ID]: {
    dimension: "[\\mathrm{L}]^3",
    formula: "V = p \\times l \\times h",
    powerLabel: "[L]^3",
    unit: "\\text{m}^3",
  },
};

export type DimensionModeId = keyof typeof DIMENSION_MODES;
export type DimensionMode = (typeof DIMENSION_MODES)[DimensionModeId];
export type SceneColors = ReturnType<typeof getDimensionSceneColors>;

export interface DimensionLabLabels {
  chooseMode: string;
  dimension: string;
  formula: string;
  modes: Record<DimensionModeId, string>;
  unit: string;
}

export interface DimensionLabProps {
  description: ReactNode;
  labels: DimensionLabLabels;
  title: ReactNode;
}

/**
 * Chooses theme-aware colors for the dimension visualizer.
 */
export function getDimensionSceneColors(resolvedTheme: string | undefined) {
  const isDarkTheme = resolvedTheme === "dark";

  return {
    block: getColor("SLATE"),
    edge: getColor("ORANGE"),
    face: getColor("TEAL"),
    groundLight: isDarkTheme ? getColor("SLATE") : getColor("STONE"),
    skyLight: ORIGIN_COLOR.LIGHT,
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
    volume: getColor("INDIGO"),
  };
}

/**
 * Narrows ToggleGroup string values to dimension lab modes.
 */
export function isDimensionModeId(value: string): value is DimensionModeId {
  return value in DIMENSION_MODES;
}

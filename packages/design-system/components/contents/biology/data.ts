import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

export type BiologyScenePoint = readonly [number, number, number];

export interface BiologyLabItem {
  caption: ReactNode;
  detail: ReactNode;
  label: string;
  structure: string;
  tab: string;
}

export interface BiologyLabLabels {
  chooseMode: string;
  detailLabel: string;
  items: readonly [BiologyLabItem, ...BiologyLabItem[]];
  sourceNote: ReactNode;
  sourceNoteLabel: string;
  structureLabel: string;
  viewLabel: string;
}

export interface BiologyLabProps {
  description: ReactNode;
  labels: BiologyLabLabels;
  title: ReactNode;
}

export interface BiologySceneColors {
  animal: string;
  arrow: string;
  carbon: string;
  decomposer: string;
  genome: string;
  heat: string;
  host: string;
  ice: string;
  membrane: string;
  microbe: string;
  muted: string;
  ocean: string;
  pathogen: string;
  plant: string;
  skyLight: string;
  soil: string;
  spore: string;
  text: string;
  warning: string;
}

export const BIOLOGY_DEFAULT_VIEW = {
  cameraPosition: [4.4, 3.2, 6.2],
  narrowCameraPosition: [5.1, 3.9, 7.3],
  cameraTarget: [0, 0.2, 0],
} satisfies Record<string, BiologyScenePoint>;

export interface BiologySceneView {
  cameraPosition: BiologyScenePoint;
  cameraTarget: BiologyScenePoint;
  narrowCameraPosition: BiologyScenePoint;
}

export interface BiologySceneProps {
  colors: BiologySceneColors;
  item: BiologyLabItem;
  selectedIndex: number;
}

export const BIOLOGY_RING_POINT_COUNT = 12;
export const BIOLOGY_SMALL_RING_POINT_COUNT = 8;

/**
 * Chooses theme-aware WebGL colors for biology scenes.
 *
 * Three.js does not parse CSS custom properties or OKLCH theme tokens directly,
 * so scene colors stay behind this adapter instead of being embedded in models.
 */
export function getBiologySceneColors(theme?: string): BiologySceneColors {
  const isDarkTheme = theme === "dark";

  return {
    animal: getColor("AMBER"),
    arrow: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
    carbon: getColor("SLATE"),
    decomposer: getColor("VIOLET"),
    genome: getColor("AMBER"),
    heat: getColor("ORANGE"),
    host: getColor("TEAL"),
    ice: getColor("CYAN"),
    membrane: getColor("VIOLET"),
    microbe: getColor("EMERALD"),
    muted: isDarkTheme ? getColor("ZINC") : getColor("SLATE"),
    ocean: getColor("SKY"),
    pathogen: getColor("ROSE"),
    plant: getColor("GREEN"),
    skyLight: ORIGIN_COLOR.LIGHT,
    soil: isDarkTheme ? getColor("STONE") : getColor("ZINC"),
    spore: getColor("FUCHSIA"),
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
    warning: getColor("RED"),
  };
}

/**
 * Narrows ToggleGroup string values to valid biology item positions.
 */
export function isBiologyItemIndex(
  value: string,
  items: readonly BiologyLabItem[]
) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < items.length;
}

/**
 * Creates stable points around a horizontal ring.
 */
export function createBiologyRingPoints(count: number, radius: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;

    return {
      id: `ring-${index}`,
      position: [
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius,
      ] satisfies BiologyScenePoint,
    };
  });
}

/**
 * Creates a compact front-facing grid for repeated particles or organisms.
 */
export function createBiologyGridPoints(rows: number, columns: number) {
  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = column - (columns - 1) / 2;
    const y = (rows - 1) / 2 - row;

    return {
      id: `grid-${index}`,
      position: [x, y, 0] satisfies BiologyScenePoint,
    };
  });
}

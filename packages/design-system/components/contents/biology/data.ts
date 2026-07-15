import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import type { ReactNode } from "react";

export type BiologyScenePoint = readonly [number, number, number];

export interface BiologyLabCallout {
  id: string;
  label: string;
}

export interface BiologyLabItem {
  callouts?: readonly BiologyLabCallout[];
  caption: ReactNode;
  focus: ReactNode;
  tab: string;
  takeaway: ReactNode;
}

export interface BiologyLabLabels {
  chooseMode: string;
  focusLabel: string;
  items: readonly [BiologyLabItem, ...BiologyLabItem[]];
  takeawayLabel: string;
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
  grain: string;
  heat: string;
  host: string;
  ice: string;
  membrane: string;
  microbe: string;
  muted: string;
  nucleus: string;
  ocean: string;
  pathogen: string;
  plant: string;
  skyLight: string;
  soil: string;
  spore: string;
  text: string;
  warning: string;
  wood: string;
}

export const BIOLOGY_DEFAULT_VIEW = {
  cameraPosition: [2.85, 2.1, 4.15],
  narrowCameraPosition: [3.15, 2.4, 4.65],
  cameraTarget: [0, 0.1, 0],
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
  const isDarkTheme = getThemeAppearance(theme) === "dark";

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
    nucleus: getColor("AMBER"),
    ocean: getColor("SKY"),
    pathogen: getColor("ROSE"),
    plant: getColor("GREEN"),
    skyLight: ORIGIN_COLOR.LIGHT,
    soil: isDarkTheme ? getColor("STONE") : getColor("ZINC"),
    spore: getColor("FUCHSIA"),
    grain: getColor("AMBER"),
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
    warning: getColor("RED"),
    wood: getColor("STONE"),
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
 * Creates evenly distributed points on a sphere for viral particles and cells.
 */
export function createBiologySpherePoints(count: number, radius: number) {
  if (count <= 0) {
    return [];
  }

  if (count === 1) {
    return [
      {
        id: "sphere-0",
        position: [0, radius, 0] satisfies BiologyScenePoint,
      },
    ];
  }

  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (index / (count - 1)) * 2;
    const ringRadius = Math.sqrt(1 - y * y);
    const angle = index * Math.PI * (3 - Math.sqrt(5));

    return {
      id: `sphere-${index}`,
      position: [
        Math.cos(angle) * ringRadius * radius,
        y * radius,
        Math.sin(angle) * ringRadius * radius,
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

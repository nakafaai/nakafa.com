import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

export const BIOLOGY_CONCEPT_IDS = [
  "virus-structure",
  "virus-replication",
  "virus-role",
  "virus-prevention",
  "biodiversity-levels",
  "classification",
  "bacteria",
  "fungi",
  "ecosystem",
  "climate-symptoms",
  "climate-impact",
  "climate-causes",
  "climate-action",
  "climate-cooperation",
] as const;

export type BiologyConceptId = (typeof BIOLOGY_CONCEPT_IDS)[number];
export type BiologySceneKind =
  | "cell"
  | "climate"
  | "network"
  | "process"
  | "virus";

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
  items: readonly BiologyLabItem[];
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
  accent: string;
  body: string;
  cell: string;
  climate: string;
  energy: string;
  membrane: string;
  muted: string;
  path: string;
  surface: string;
  text: string;
  virus: string;
}

export const BIOLOGY_SCENE_VIEW = {
  cameraPosition: [4.6, 3.4, 6.2],
  narrowCameraPosition: [5.3, 4.1, 7.1],
  cameraTarget: [0, 0.2, 0],
} satisfies Record<string, BiologyScenePoint>;

export const BIOLOGY_CONCEPT_SCENE_KIND = {
  bacteria: "cell",
  "biodiversity-levels": "virus",
  classification: "network",
  "climate-action": "climate",
  "climate-causes": "climate",
  "climate-cooperation": "climate",
  "climate-impact": "climate",
  "climate-symptoms": "climate",
  ecosystem: "network",
  fungi: "cell",
  "virus-prevention": "process",
  "virus-replication": "process",
  "virus-role": "virus",
  "virus-structure": "virus",
} satisfies Record<BiologyConceptId, BiologySceneKind>;

/**
 * Chooses semantic WebGL colors for biology scenes.
 *
 * Three.js does not parse CSS custom properties or OKLCH theme tokens directly,
 * so scene colors stay behind this adapter instead of being embedded in models.
 */
export function getBiologySceneColors(theme?: string): BiologySceneColors {
  const isDarkTheme = theme === "dark";

  return {
    accent: getColor("SKY"),
    body: getColor("EMERALD"),
    cell: getColor("TEAL"),
    climate: getColor("CYAN"),
    energy: getColor("AMBER"),
    membrane: getColor("VIOLET"),
    muted: isDarkTheme ? getColor("ZINC") : getColor("SLATE"),
    path: getColor("AMBER"),
    surface: isDarkTheme ? getColor("SLATE") : getColor("STONE"),
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
    virus: getColor("ROSE"),
  };
}

/**
 * Narrows ToggleGroup string values to valid biology item positions.
 */
export function isBiologyItemIndex(value: string, items: readonly unknown[]) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < items.length;
}

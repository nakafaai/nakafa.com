import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

export const ATOMIC_RADIUS_MODE_ID = "atomic-radius";
export const IONIZATION_ENERGY_MODE_ID = "ionization-energy";
export const ELECTRON_AFFINITY_MODE_ID = "electron-affinity";
export const ELECTRONEGATIVITY_MODE_ID = "electronegativity";

export type PeriodicPropertyModeId =
  | typeof ATOMIC_RADIUS_MODE_ID
  | typeof IONIZATION_ENERGY_MODE_ID
  | typeof ELECTRON_AFFINITY_MODE_ID
  | typeof ELECTRONEGATIVITY_MODE_ID;

export const PERIODIC_PROPERTY_MODE_IDS = [
  ATOMIC_RADIUS_MODE_ID,
  IONIZATION_ENERGY_MODE_ID,
  ELECTRON_AFFINITY_MODE_ID,
  ELECTRONEGATIVITY_MODE_ID,
] satisfies PeriodicPropertyModeId[];

type PeriodicPropertyColorKey = Parameters<typeof getColor>[0];
type PeriodicPropertyMarker = "sphere" | "pillar";

export interface PeriodicPropertySample {
  symbol: string;
  value: number;
}

export interface PeriodicPropertyMode {
  colorKey: PeriodicPropertyColorKey;
  groupSamples: readonly PeriodicPropertySample[];
  marker: PeriodicPropertyMarker;
  periodSamples: readonly PeriodicPropertySample[];
}

export const PERIODIC_PROPERTY_MODES = {
  [ATOMIC_RADIUS_MODE_ID]: {
    colorKey: "TEAL",
    marker: "sphere",
    periodSamples: [
      { symbol: "Na", value: 186 },
      { symbol: "Mg", value: 160 },
      { symbol: "Al", value: 143 },
      { symbol: "Si", value: 118 },
      { symbol: "P", value: 110 },
      { symbol: "S", value: 103 },
      { symbol: "Cl", value: 99 },
    ],
    groupSamples: [
      { symbol: "N", value: 75 },
      { symbol: "P", value: 110 },
      { symbol: "As", value: 125 },
      { symbol: "Sb", value: 145 },
      { symbol: "Bi", value: 155 },
    ],
  },
  [IONIZATION_ENERGY_MODE_ID]: {
    colorKey: "ORANGE",
    marker: "pillar",
    periodSamples: [
      { symbol: "Na", value: 495.9 },
      { symbol: "Mg", value: 738.1 },
      { symbol: "Al", value: 577.9 },
      { symbol: "Si", value: 786.3 },
      { symbol: "P", value: 1012 },
      { symbol: "S", value: 999.5 },
      { symbol: "Cl", value: 1251 },
      { symbol: "Ar", value: 1521 },
    ],
    groupSamples: [
      { symbol: "Li", value: 520.2 },
      { symbol: "Na", value: 495.9 },
      { symbol: "K", value: 418.7 },
      { symbol: "Rb", value: 403 },
      { symbol: "Cs", value: 375.7 },
    ],
  },
  [ELECTRON_AFFINITY_MODE_ID]: {
    colorKey: "VIOLET",
    marker: "pillar",
    periodSamples: [
      { symbol: "Na", value: 53 },
      { symbol: "Mg", value: 0 },
      { symbol: "Al", value: 43 },
      { symbol: "Si", value: 134 },
      { symbol: "P", value: 72 },
      { symbol: "S", value: 200 },
      { symbol: "Cl", value: 349 },
      { symbol: "Ar", value: 0 },
    ],
    groupSamples: [
      { symbol: "F", value: 328 },
      { symbol: "Cl", value: 349 },
      { symbol: "Br", value: 325 },
      { symbol: "I", value: 295 },
    ],
  },
  [ELECTRONEGATIVITY_MODE_ID]: {
    colorKey: "SKY",
    marker: "pillar",
    periodSamples: [
      { symbol: "Na", value: 0.93 },
      { symbol: "Mg", value: 1.31 },
      { symbol: "Al", value: 1.61 },
      { symbol: "Si", value: 1.9 },
      { symbol: "P", value: 2.19 },
      { symbol: "S", value: 2.58 },
      { symbol: "Cl", value: 3.16 },
    ],
    groupSamples: [
      { symbol: "F", value: 3.98 },
      { symbol: "Cl", value: 3.16 },
      { symbol: "Br", value: 2.96 },
      { symbol: "I", value: 2.66 },
    ],
  },
} satisfies Record<PeriodicPropertyModeId, PeriodicPropertyMode>;

export interface PeriodicPropertiesModeLabels {
  cause: ReactNode;
  groupTrend: ReactNode;
  guidance: ReactNode;
  name: string;
  periodTrend: ReactNode;
  question: ReactNode;
  tab: string;
}

export interface PeriodicPropertiesLabLabels {
  chooseTrend: string;
  factLabels: {
    cause: string;
    group: string;
    period: string;
    question: string;
  };
  modes: Record<PeriodicPropertyModeId, PeriodicPropertiesModeLabels>;
  sceneLabel: string;
}

export interface PeriodicPropertiesLabProps {
  description: ReactNode;
  labels: PeriodicPropertiesLabLabels;
  title: ReactNode;
}

export type PeriodicPropertiesSceneColors = ReturnType<
  typeof getPeriodicPropertiesSceneColors
>;

/**
 * Narrows toggle values to the available periodic-property modes.
 */
export function isPeriodicPropertyModeId(
  value: string
): value is PeriodicPropertyModeId {
  return PERIODIC_PROPERTY_MODE_IDS.some((modeId) => modeId === value);
}

/**
 * Resolves the deterministic data color for one periodic-property mode.
 */
export function getPeriodicPropertyModeColor(modeId: PeriodicPropertyModeId) {
  return getColor(PERIODIC_PROPERTY_MODES[modeId].colorKey);
}

/**
 * Chooses readable colors for the 3D periodic-properties scene.
 */
export function getPeriodicPropertiesSceneColors(
  resolvedTheme: string | undefined
) {
  const isDarkTheme = resolvedTheme === "dark";

  return {
    groundLight: isDarkTheme ? getColor("SLATE") : getColor("STONE"),
    markerText: ORIGIN_COLOR.LIGHT,
    markerTextOutline: ORIGIN_COLOR.DARK,
    rail: isDarkTheme ? getColor("SLATE") : getColor("GRAY"),
    skyLight: ORIGIN_COLOR.LIGHT,
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}

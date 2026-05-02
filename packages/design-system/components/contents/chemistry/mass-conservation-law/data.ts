import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

export const CLOSED_SYSTEM_MODE_ID = "closed";
export const OPEN_SYSTEM_MODE_ID = "open";

export const MASS_CONSERVATION_MODE_IDS = [
  CLOSED_SYSTEM_MODE_ID,
  OPEN_SYSTEM_MODE_ID,
] as const;

export type MassConservationModeId =
  (typeof MASS_CONSERVATION_MODE_IDS)[number];

export type MassConservationSceneColors = ReturnType<
  typeof getMassConservationSceneColors
>;
export type MassConservationScenePoint = readonly [number, number, number];

export interface MassConservationModeLabels {
  calculation: ReactNode;
  helperCaption: ReactNode;
  readoutAfter: string;
  readoutBefore: string;
  system: ReactNode;
  tab: string;
}

export interface MassConservationLabLabels {
  after: string;
  before: string;
  calculationLabel: string;
  chooseMode: string;
  modes: Record<MassConservationModeId, MassConservationModeLabels>;
  reactionView: string;
  systemLabel: string;
}

export interface MassConservationLabProps {
  description: ReactNode;
  labels: MassConservationLabLabels;
  title: ReactNode;
}

export const MASS_CONSERVATION_MODES = {
  [CLOSED_SYSTEM_MODE_ID]: {
    kind: CLOSED_SYSTEM_MODE_ID,
  },
  [OPEN_SYSTEM_MODE_ID]: {
    kind: OPEN_SYSTEM_MODE_ID,
  },
} satisfies Record<
  MassConservationModeId,
  {
    kind: MassConservationModeId;
  }
>;

export const MASS_CONSERVATION_SCENE_VIEW = {
  cameraPosition: [0, 2.45, 5.6],
  cameraTarget: [0, -0.1, 0],
  narrowCameraPosition: [0, 2.7, 5.65],
} satisfies Record<string, MassConservationScenePoint>;

export function isMassConservationModeId(
  value: string
): value is MassConservationModeId {
  return value in MASS_CONSERVATION_MODES;
}

export function getMassConservationSceneColors(
  resolvedTheme: string | undefined
) {
  const isDarkTheme = resolvedTheme === "dark";

  return {
    arrow: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
    balance: isDarkTheme ? getColor("ZINC") : getColor("SLATE"),
    cap: getColor("CYAN"),
    escapedGas: getColor("SKY"),
    glass: getColor("CYAN"),
    groundLight: isDarkTheme ? getColor("SLATE") : getColor("STONE"),
    product: getColor("EMERALD"),
    sulfur: getColor("YELLOW"),
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
    zinc: getColor("ZINC"),
  };
}

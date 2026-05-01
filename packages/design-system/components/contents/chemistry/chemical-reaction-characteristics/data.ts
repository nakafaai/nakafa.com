import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

export const GAS_CUE_ID = "gas";
export const PRECIPITATE_CUE_ID = "precipitate";
export const COLOR_CUE_ID = "color";
export const ENERGY_CUE_ID = "energy";

export const REACTION_CUE_IDS = [
  GAS_CUE_ID,
  PRECIPITATE_CUE_ID,
  COLOR_CUE_ID,
  ENERGY_CUE_ID,
] as const;

export type ReactionCueId = (typeof REACTION_CUE_IDS)[number];
export type ReactionSceneColors = ReturnType<typeof getReactionSceneColors>;
export type ReactionScenePoint = readonly [number, number, number];

export interface ReactionCueLabels {
  afterCaption: ReactNode;
  beforeCaption: ReactNode;
  limit: ReactNode;
  meaning: ReactNode;
  observation: ReactNode;
  tab: string;
}

export interface ReactionCharacteristicsLabLabels {
  after: string;
  before: string;
  chooseCue: string;
  cues: Record<ReactionCueId, ReactionCueLabels>;
  limitLabel: string;
  meaningLabel: string;
  observationLabel: string;
  transition: string;
}

export interface ReactionCharacteristicsLabProps {
  description: ReactNode;
  labels: ReactionCharacteristicsLabLabels;
  title: ReactNode;
}

export const REACTION_CUES = {
  [GAS_CUE_ID]: {
    kind: GAS_CUE_ID,
  },
  [PRECIPITATE_CUE_ID]: {
    kind: PRECIPITATE_CUE_ID,
  },
  [COLOR_CUE_ID]: {
    kind: COLOR_CUE_ID,
  },
  [ENERGY_CUE_ID]: {
    kind: ENERGY_CUE_ID,
  },
} satisfies Record<
  ReactionCueId,
  {
    kind: ReactionCueId;
  }
>;

export const REACTION_SCENE_VIEW = {
  cameraPosition: [0, 2.2, 4.2],
  cameraTarget: [0, 0.05, 0],
  narrowCameraPosition: [0, 2.65, 4.75],
} satisfies Record<string, ReactionScenePoint>;

/**
 * Narrows ToggleGroup string values to the available reaction cue IDs.
 */
export function isReactionCueId(value: string): value is ReactionCueId {
  return value in REACTION_CUES;
}

/**
 * Chooses theme-aware colors for the 3D reaction clue scene.
 */
export function getReactionSceneColors(resolvedTheme: string | undefined) {
  const isDarkTheme = resolvedTheme === "dark";

  return {
    arrow: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
    bubble: getColor("SKY"),
    glass: getColor("CYAN"),
    groundLight: isDarkTheme ? getColor("SLATE") : getColor("STONE"),
    heat: getColor("ORANGE"),
    liquidAfterColor: getColor("AMBER"),
    liquidBase: isDarkTheme ? getColor("SLATE") : getColor("GRAY"),
    liquidGas: getColor("CYAN"),
    liquidWarm: getColor("ORANGE"),
    precipitate: getColor("EMERALD"),
    skyLight: ORIGIN_COLOR.LIGHT,
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}

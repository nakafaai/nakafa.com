import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

export const COMBUSTION_TYPE_ID = "combustion";
export const RUST_TYPE_ID = "rust";
export const PRECIPITATE_TYPE_ID = "precipitate";
export const GAS_TYPE_ID = "gas";

export const CHEMICAL_REACTION_TYPE_IDS = [
  COMBUSTION_TYPE_ID,
  RUST_TYPE_ID,
  PRECIPITATE_TYPE_ID,
  GAS_TYPE_ID,
] as const;

export type ChemicalReactionTypeId =
  (typeof CHEMICAL_REACTION_TYPE_IDS)[number];
export type ChemicalReactionTypeSceneColors = ReturnType<
  typeof getChemicalReactionTypeSceneColors
>;
export type ChemicalReactionTypeScenePoint = readonly [number, number, number];

export interface ChemicalReactionTypeLabels {
  afterCaption: ReactNode;
  beforeCaption: ReactNode;
  check: ReactNode;
  equation: ReactNode;
  reading: ReactNode;
  tab: string;
  visibleCue: ReactNode;
}

export interface ChemicalReactionTypesLabLabels {
  after: string;
  before: string;
  checkLabel: string;
  chooseType: string;
  equationLabel: string;
  reactionView: string;
  readingLabel: string;
  types: Record<ChemicalReactionTypeId, ChemicalReactionTypeLabels>;
  visibleCueLabel: string;
}

export interface ChemicalReactionTypesLabProps {
  description: ReactNode;
  labels: ChemicalReactionTypesLabLabels;
  title: ReactNode;
}

export const CHEMICAL_REACTION_TYPES = {
  [COMBUSTION_TYPE_ID]: {
    kind: COMBUSTION_TYPE_ID,
  },
  [RUST_TYPE_ID]: {
    kind: RUST_TYPE_ID,
  },
  [PRECIPITATE_TYPE_ID]: {
    kind: PRECIPITATE_TYPE_ID,
  },
  [GAS_TYPE_ID]: {
    kind: GAS_TYPE_ID,
  },
} satisfies Record<
  ChemicalReactionTypeId,
  {
    kind: ChemicalReactionTypeId;
  }
>;

export const CHEMICAL_REACTION_TYPES_SCENE_VIEW = {
  cameraPosition: [0, 1.8, 4],
  cameraTarget: [0, 0, 0],
  narrowCameraPosition: [0, 2, 4.3],
} satisfies Record<string, ChemicalReactionTypeScenePoint>;

/**
 * Narrows ToggleGroup string values to the available reaction type IDs.
 */
export function isChemicalReactionTypeId(
  value: string
): value is ChemicalReactionTypeId {
  return value in CHEMICAL_REACTION_TYPES;
}

/**
 * Chooses theme-aware colors for the 3D reaction-type scene.
 */
export function getChemicalReactionTypeSceneColors(
  resolvedTheme: string | undefined
) {
  const isDarkTheme = resolvedTheme === "dark";

  return {
    arrow: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
    bubble: getColor("SKY"),
    calcium: getColor("STONE"),
    carbon: getColor("SLATE"),
    flame: getColor("ORANGE"),
    glass: getColor("CYAN"),
    groundLight: isDarkTheme ? getColor("SLATE") : getColor("STONE"),
    hydrogen: getColor("ZINC"),
    iron: getColor("SLATE"),
    liquid: isDarkTheme ? getColor("SLATE") : getColor("GRAY"),
    oxygen: getColor("SKY"),
    phosphorus: getColor("AMBER"),
    precipitate: ORIGIN_COLOR.LIGHT,
    rust: getColor("ORANGE"),
    rustPatch: getColor("AMBER"),
    skyLight: ORIGIN_COLOR.LIGHT,
    sphereText: ORIGIN_COLOR.LIGHT,
    sphereTextOutline: ORIGIN_COLOR.DARK,
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}

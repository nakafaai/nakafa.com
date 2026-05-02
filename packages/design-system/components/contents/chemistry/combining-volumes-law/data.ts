import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

export const WATER_VAPOR_MODE_ID = "water-vapor";
export const AMMONIA_SYNTHESIS_MODE_ID = "ammonia-synthesis";
export const AMMONIA_DECOMPOSITION_MODE_ID = "ammonia-decomposition";

export const COMBINING_VOLUMES_MODE_IDS = [
  WATER_VAPOR_MODE_ID,
  AMMONIA_SYNTHESIS_MODE_ID,
  AMMONIA_DECOMPOSITION_MODE_ID,
] as const;

export type CombiningVolumesModeId =
  (typeof COMBINING_VOLUMES_MODE_IDS)[number];
export type CombiningVolumesElement = "hydrogen" | "nitrogen" | "oxygen";
export type CombiningVolumesMoleculeKind =
  | "ammonia"
  | "hydrogen"
  | "nitrogen"
  | "oxygen"
  | "water-vapor";
export type CombiningVolumesSceneColors = ReturnType<
  typeof getCombiningVolumesSceneColors
>;
export type CombiningVolumesScenePoint = readonly [number, number, number];

export interface CombiningVolumesGasModel {
  fillColor: keyof Pick<
    CombiningVolumesSceneColors,
    "hydrogenGas" | "nitrogenGas" | "oxygenGas" | "steamGas"
  >;
  formulaLabel: string;
  id: string;
  moleculeKind: CombiningVolumesMoleculeKind;
  volumeUnits: number;
}

export interface CombiningVolumesModeModel {
  products: readonly CombiningVolumesGasModel[];
  reactants: readonly CombiningVolumesGasModel[];
}

export interface CombiningVolumesModeLabels {
  example: ReactNode;
  helperCaption: ReactNode;
  ratio: ReactNode;
  tab: ReactNode;
  tabLabel: string;
}

export interface CombiningVolumesLabLabels {
  chooseMode: string;
  exampleLabel: string;
  modes: Record<CombiningVolumesModeId, CombiningVolumesModeLabels>;
  products: string;
  ratioLabel: string;
  reactants: string;
  reactionView: string;
  volumeUnit: string;
}

export interface CombiningVolumesLabProps {
  description: ReactNode;
  labels: CombiningVolumesLabLabels;
  title: ReactNode;
}

export const COMBINING_VOLUMES_SCENE_VIEW = {
  cameraPosition: [0, 2.15, 4.35],
  cameraTarget: [0, 0.02, 0],
  narrowCameraPosition: [0, 2.62, 5.8],
} satisfies Record<string, CombiningVolumesScenePoint>;

export const COMBINING_VOLUMES_MODELS = {
  [WATER_VAPOR_MODE_ID]: {
    reactants: [
      gas("hydrogen", "H\u2082", 2, "hydrogen", "hydrogenGas"),
      gas("oxygen", "O\u2082", 1, "oxygen", "oxygenGas"),
    ],
    products: [gas("steam", "H\u2082O", 2, "water-vapor", "steamGas")],
  },
  [AMMONIA_SYNTHESIS_MODE_ID]: {
    reactants: [
      gas("nitrogen", "N\u2082", 1, "nitrogen", "nitrogenGas"),
      gas("hydrogen", "H\u2082", 3, "hydrogen", "hydrogenGas"),
    ],
    products: [gas("ammonia", "NH\u2083", 2, "ammonia", "nitrogenGas")],
  },
  [AMMONIA_DECOMPOSITION_MODE_ID]: {
    reactants: [gas("ammonia", "NH\u2083", 2, "ammonia", "nitrogenGas")],
    products: [
      gas("hydrogen", "H\u2082", 3, "hydrogen", "hydrogenGas"),
      gas("nitrogen", "N\u2082", 1, "nitrogen", "nitrogenGas"),
    ],
  },
} satisfies Record<CombiningVolumesModeId, CombiningVolumesModeModel>;

export function isCombiningVolumesModeId(
  value: string
): value is CombiningVolumesModeId {
  return value in COMBINING_VOLUMES_MODELS;
}

export function getCombiningVolumesSceneColors(
  resolvedTheme: string | undefined
) {
  const isDarkTheme = resolvedTheme === "dark";

  return {
    arrow: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
    bond: isDarkTheme ? getColor("ZINC") : getColor("SLATE"),
    glass: getColor("CYAN"),
    hydrogen: isDarkTheme ? getColor("ZINC") : getColor("NEUTRAL"),
    hydrogenGas: getColor("SLATE"),
    nitrogen: getColor("VIOLET"),
    nitrogenGas: getColor("VIOLET"),
    oxygen: getColor("SKY"),
    oxygenGas: getColor("SKY"),
    sphereText: ORIGIN_COLOR.LIGHT,
    sphereTextOutline: isDarkTheme ? ORIGIN_COLOR.DARK : getColor("SLATE"),
    steamGas: getColor("TEAL"),
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}

function gas(
  id: string,
  formulaLabel: string,
  volumeUnits: number,
  moleculeKind: CombiningVolumesMoleculeKind,
  fillColor: CombiningVolumesGasModel["fillColor"]
): CombiningVolumesGasModel {
  return { fillColor, formulaLabel, id, moleculeKind, volumeUnits };
}

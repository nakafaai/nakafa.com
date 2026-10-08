import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { Schema } from "effect";
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
export const CombiningVolumesElementSchema = Schema.Literals([
  "hydrogen",
  "nitrogen",
  "oxygen",
]);
export type CombiningVolumesElement = typeof CombiningVolumesElementSchema.Type;

const CombiningVolumesMoleculeKindSchema = Schema.Literals([
  "ammonia",
  "hydrogen",
  "nitrogen",
  "oxygen",
  "water-vapor",
]);
export type CombiningVolumesMoleculeKind =
  typeof CombiningVolumesMoleculeKindSchema.Type;
export type CombiningVolumesSceneColors = ReturnType<
  typeof getCombiningVolumesSceneColors
>;

export const CombiningVolumesScenePointSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type CombiningVolumesScenePoint =
  typeof CombiningVolumesScenePointSchema.Type;

export const CombiningVolumesSceneLabelsSchema = Schema.Struct({
  products: Schema.String,
  reactants: Schema.String,
  volumeUnit: Schema.String,
});

const CombiningVolumesGasModelSchema = Schema.Struct({
  fillColor: Schema.Literals([
    "hydrogenGas",
    "nitrogenGas",
    "oxygenGas",
    "steamGas",
  ]),
  formulaLabel: Schema.String,
  id: Schema.String,
  moleculeKind: CombiningVolumesMoleculeKindSchema,
  volumeUnits: Schema.Finite,
});
export type CombiningVolumesGasModel =
  typeof CombiningVolumesGasModelSchema.Type;

const CombiningVolumesModeModelSchema = Schema.Struct({
  products: Schema.Array(CombiningVolumesGasModelSchema),
  reactants: Schema.Array(CombiningVolumesGasModelSchema),
});
export type CombiningVolumesModeModel =
  typeof CombiningVolumesModeModelSchema.Type;

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

export const COMBINING_VOLUMES_SCENE_VIEW = {
  cameraPosition: [0, 2.15, 4.35],
  cameraTarget: [0, 0.02, 0],
  narrowCameraPosition: [0, 2.62, 5.8],
} satisfies Record<string, CombiningVolumesScenePoint>;

export const COMBINING_VOLUMES_MODELS = {
  [WATER_VAPOR_MODE_ID]: {
    reactants: [
      gas("hydrogen", "\\mathrm{H_2}", 2, "hydrogen", "hydrogenGas"),
      gas("oxygen", "\\mathrm{O_2}", 1, "oxygen", "oxygenGas"),
    ],
    products: [gas("steam", "\\mathrm{H_2O}", 2, "water-vapor", "steamGas")],
  },
  [AMMONIA_SYNTHESIS_MODE_ID]: {
    reactants: [
      gas("nitrogen", "\\mathrm{N_2}", 1, "nitrogen", "nitrogenGas"),
      gas("hydrogen", "\\mathrm{H_2}", 3, "hydrogen", "hydrogenGas"),
    ],
    products: [gas("ammonia", "\\mathrm{NH_3}", 2, "ammonia", "nitrogenGas")],
  },
  [AMMONIA_DECOMPOSITION_MODE_ID]: {
    reactants: [gas("ammonia", "\\mathrm{NH_3}", 2, "ammonia", "nitrogenGas")],
    products: [
      gas("hydrogen", "\\mathrm{H_2}", 3, "hydrogen", "hydrogenGas"),
      gas("nitrogen", "\\mathrm{N_2}", 1, "nitrogen", "nitrogenGas"),
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
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";

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

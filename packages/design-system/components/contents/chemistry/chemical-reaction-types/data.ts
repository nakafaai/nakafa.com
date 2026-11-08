import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { Array as Arr, Schema } from "effect";

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
export const ChemicalReactionTypeScenePointSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type ChemicalReactionTypeScenePoint =
  typeof ChemicalReactionTypeScenePointSchema.Type;

export const ChemicalReactionTypeSceneLabelsSchema = Schema.Struct({
  after: Schema.String,
  before: Schema.String,
});

export const CHEMICAL_REACTION_TYPES_SCENE_VIEW = {
  cameraPosition: [0, 1.8, 4],
  cameraTarget: [0, 0, 0],
  narrowCameraPosition: [0, 2.1, 4.9],
} satisfies Record<string, ChemicalReactionTypeScenePoint>;

/**
 * Narrows ToggleGroup string values to the available reaction type IDs.
 */
export function isChemicalReactionTypeId(
  value: string
): value is ChemicalReactionTypeId {
  return Arr.some(CHEMICAL_REACTION_TYPE_IDS, (id) => id === value);
}

/**
 * Chooses theme-aware colors for the 3D reaction-type scene.
 */
export function getChemicalReactionTypeSceneColors(
  resolvedTheme: string | undefined
) {
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";

  return {
    arrow: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
    bubble: PLOT_COLORS.teal,
    calcium: getColor("STONE"),
    carbon: PLOT_COLORS.slate,
    flame: PLOT_COLORS.orange,
    glass: getColor("SLATE", 300),
    hydrogen: getColor("ZINC"),
    iron: PLOT_COLORS.slate,
    liquid: isDarkTheme ? PLOT_COLORS.slate : getColor("GRAY"),
    oxygen: PLOT_COLORS.teal,
    phosphorus: PLOT_COLORS.amber,
    precipitate: ORIGIN_COLOR.LIGHT,
    rust: PLOT_COLORS.orange,
    rustPatch: PLOT_COLORS.amber,
    sphereText: ORIGIN_COLOR.LIGHT,
    sphereTextOutline: ORIGIN_COLOR.DARK,
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}

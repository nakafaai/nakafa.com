import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { Schema } from "effect";

export const BiologyScenePointSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);

export type BiologyScenePoint = typeof BiologyScenePointSchema.Type;

const BiologySceneColorsSchema = Schema.Struct({
  animal: Schema.String,
  arrow: Schema.String,
  carbon: Schema.String,
  decomposer: Schema.String,
  genome: Schema.String,
  grain: Schema.String,
  heat: Schema.String,
  host: Schema.String,
  ice: Schema.String,
  membrane: Schema.String,
  microbe: Schema.String,
  muted: Schema.String,
  nucleus: Schema.String,
  ocean: Schema.String,
  pathogen: Schema.String,
  plant: Schema.String,
  skyLight: Schema.String,
  spore: Schema.String,
  text: Schema.String,
  wood: Schema.String,
});

export type BiologySceneColors = typeof BiologySceneColorsSchema.Type;

export const BIOLOGY_DEFAULT_VIEW = {
  cameraPosition: [2.85, 2.1, 4.15],
  narrowCameraPosition: [3.15, 2.4, 4.65],
  cameraTarget: [0, 0.1, 0],
} satisfies Record<string, BiologyScenePoint>;

/** The item a biology lab opens on, which its static card draws until the reader picks another. */
export const BIOLOGY_DEFAULT_ITEM_INDEX = 0;

/**
 * Chooses theme-aware WebGL colors for biology scenes.
 *
 * Three.js does not parse CSS custom properties or OKLCH theme tokens directly,
 * so scene colors stay behind this adapter instead of being embedded in models.
 */
export function getBiologySceneColors(theme?: string): BiologySceneColors {
  const isDarkTheme = getThemeAppearance(theme) === "dark";

  return {
    animal: PLOT_COLORS.amber,
    arrow: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
    carbon: PLOT_COLORS.slate,
    decomposer: PLOT_COLORS.violet,
    genome: PLOT_COLORS.amber,
    heat: PLOT_COLORS.orange,
    host: PLOT_COLORS.teal,
    ice: getColor("SLATE", 300),
    membrane: PLOT_COLORS.violet,
    microbe: PLOT_COLORS.orange,
    muted: isDarkTheme ? getColor("ZINC") : PLOT_COLORS.slate,
    nucleus: PLOT_COLORS.amber,
    ocean: PLOT_COLORS.teal,
    pathogen: PLOT_COLORS.pink,
    plant: PLOT_COLORS.teal,
    skyLight: ORIGIN_COLOR.LIGHT,
    spore: PLOT_COLORS.fuchsia,
    grain: PLOT_COLORS.amber,
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
    wood: getColor("STONE"),
  };
}

/**
 * Narrows ToggleGroup string values to valid biology item positions.
 */
export function isBiologyItemIndex(value: string, itemCount: number) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < itemCount;
}

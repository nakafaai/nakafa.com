import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
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
  soil: Schema.String,
  spore: Schema.String,
  text: Schema.String,
  warning: Schema.String,
  wood: Schema.String,
});

export type BiologySceneColors = typeof BiologySceneColorsSchema.Type;

export const BIOLOGY_DEFAULT_VIEW = {
  cameraPosition: [2.85, 2.1, 4.15],
  narrowCameraPosition: [3.15, 2.4, 4.65],
  cameraTarget: [0, 0.1, 0],
} satisfies Record<string, BiologyScenePoint>;

const BiologySceneViewSchema = Schema.Struct({
  cameraPosition: BiologyScenePointSchema,
  cameraTarget: BiologyScenePointSchema,
  narrowCameraPosition: BiologyScenePointSchema,
});

export type BiologySceneView = typeof BiologySceneViewSchema.Type;

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
export function isBiologyItemIndex(value: string, itemCount: number) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < itemCount;
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

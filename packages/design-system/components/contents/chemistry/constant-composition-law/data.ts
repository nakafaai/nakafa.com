import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { Schema } from "effect";

export const EXACT_RATIO_MODE_ID = "exact";
export const HYDROGEN_EXCESS_MODE_ID = "hydrogen-excess";
export const OXYGEN_EXCESS_MODE_ID = "oxygen-excess";

export const CONSTANT_COMPOSITION_MODE_IDS = [
  EXACT_RATIO_MODE_ID,
  HYDROGEN_EXCESS_MODE_ID,
  OXYGEN_EXCESS_MODE_ID,
] as const;

export type ConstantCompositionModeId =
  (typeof CONSTANT_COMPOSITION_MODE_IDS)[number];

export type ConstantCompositionSceneColors = ReturnType<
  typeof getConstantCompositionSceneColors
>;
export const ConstantCompositionScenePointSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type ConstantCompositionScenePoint =
  typeof ConstantCompositionScenePointSchema.Type;

export const CONSTANT_COMPOSITION_MODES = {
  [EXACT_RATIO_MODE_ID]: {
    kind: EXACT_RATIO_MODE_ID,
  },
  [HYDROGEN_EXCESS_MODE_ID]: {
    kind: HYDROGEN_EXCESS_MODE_ID,
  },
  [OXYGEN_EXCESS_MODE_ID]: {
    kind: OXYGEN_EXCESS_MODE_ID,
  },
} satisfies Record<
  ConstantCompositionModeId,
  {
    kind: ConstantCompositionModeId;
  }
>;

export const CONSTANT_COMPOSITION_SCENE_VIEW = {
  cameraPosition: [0, 2.0, 4.55],
  cameraTarget: [0, 0, 0],
  narrowCameraPosition: [0, 2.35, 5.1],
} satisfies Record<string, ConstantCompositionScenePoint>;

export function isConstantCompositionModeId(
  value: string
): value is ConstantCompositionModeId {
  return value in CONSTANT_COMPOSITION_MODES;
}

export function getConstantCompositionSceneColors(
  resolvedTheme: string | undefined
) {
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";

  return {
    arrow: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
    bond: isDarkTheme ? getColor("ZINC") : getColor("SLATE"),
    hydrogen: isDarkTheme ? getColor("ZINC") : getColor("STONE"),
    oxygen: getColor("SKY"),
    sphereText: ORIGIN_COLOR.LIGHT,
    sphereTextOutline: isDarkTheme ? ORIGIN_COLOR.DARK : getColor("SLATE"),
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}

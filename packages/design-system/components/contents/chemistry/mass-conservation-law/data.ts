import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { Array as Arr, Schema } from "effect";

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
export const MassConservationScenePointSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
type MassConservationScenePoint = typeof MassConservationScenePointSchema.Type;

export const MASS_CONSERVATION_SCENE_VIEW = {
  cameraPosition: [0, 2.45, 5.6],
  cameraTarget: [0, -0.1, 0],
  narrowCameraPosition: [0, 2.7, 5.65],
} satisfies Record<string, MassConservationScenePoint>;

export function isMassConservationModeId(
  value: string
): value is MassConservationModeId {
  return Arr.some(MASS_CONSERVATION_MODE_IDS, (id) => id === value);
}

export function getMassConservationSceneColors(
  resolvedTheme: string | undefined
) {
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";

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

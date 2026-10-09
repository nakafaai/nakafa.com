import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";

/** The atom and label colors of a particle scene for the resolved theme. */
export function getAtomSceneColors(resolvedTheme: string | undefined) {
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";

  return {
    bond: isDarkTheme ? getColor("ZINC") : getColor("SLATE"),
    carbon: isDarkTheme ? getColor("ZINC") : getColor("STONE"),
    hydrogen: isDarkTheme ? getColor("ZINC") : getColor("NEUTRAL"),
    nitrogen: getColor("VIOLET"),
    oxygen: getColor("SKY"),
    sphereText: ORIGIN_COLOR.LIGHT,
    sphereTextOutline: isDarkTheme ? ORIGIN_COLOR.DARK : getColor("SLATE"),
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}

import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";

/** The atom and label colors of a particle scene for the resolved theme. */
export function getAtomSceneColors(resolvedTheme: string | undefined) {
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";

  return {
    bond: isDarkTheme ? getColor("ZINC") : PLOT_COLORS.slate,
    carbon: isDarkTheme ? getColor("ZINC") : getColor("STONE"),
    hydrogen: isDarkTheme ? getColor("ZINC") : getColor("NEUTRAL"),
    nitrogen: PLOT_COLORS.violet,
    oxygen: PLOT_COLORS.teal,
    sphereText: ORIGIN_COLOR.LIGHT,
    sphereTextOutline: isDarkTheme ? ORIGIN_COLOR.DARK : PLOT_COLORS.slate,
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}

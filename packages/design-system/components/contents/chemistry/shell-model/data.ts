import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { Schema } from "effect";

const ShellModelSampleSchema = Schema.Struct({
  atomicNumber: Schema.Finite,
  symbol: Schema.String,
});
export type ShellModelSample = typeof ShellModelSampleSchema.Type;

const ShellModelShellSchema = Schema.Struct({
  electronCount: Schema.Finite,
  key: Schema.String,
});
type ShellModelShell = typeof ShellModelShellSchema.Type;

export type ShellModelShells = readonly ShellModelShell[];

export type ShellModelSceneColors = ReturnType<typeof getShellModelSceneColors>;

/**
 * Chooses theme-aware colors for shared electron-shell scenes.
 */
export function getShellModelSceneColors(resolvedTheme: string | undefined) {
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";

  return {
    electron: PLOT_COLORS.violet,
    nucleus: PLOT_COLORS.pink,
    outerElectron: PLOT_COLORS.orange,
    outerShell: PLOT_COLORS.orange,
    shell: isDarkTheme ? PLOT_COLORS.slate : getColor("GRAY"),
    sphereText: ORIGIN_COLOR.LIGHT,
    sphereTextOutline: ORIGIN_COLOR.DARK,
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}

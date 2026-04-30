import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";

export interface ShellModelSample {
  atomicNumber: number;
  symbol: string;
}

export interface ShellModelShell {
  electronCount: number;
  key: string;
}

export type ShellModelShells = readonly ShellModelShell[];

export type ShellModelSceneColors = ReturnType<typeof getShellModelSceneColors>;

/**
 * Chooses theme-aware colors for shared electron-shell scenes.
 */
export function getShellModelSceneColors(resolvedTheme: string | undefined) {
  const isDarkTheme = resolvedTheme === "dark";

  return {
    electron: isDarkTheme ? getColor("CYAN") : getColor("TEAL"),
    groundLight: isDarkTheme ? getColor("SLATE") : getColor("STONE"),
    nucleus: getColor("ROSE"),
    outerElectron: getColor("ORANGE"),
    outerShell: getColor("ORANGE"),
    shell: isDarkTheme ? getColor("SLATE") : getColor("GRAY"),
    skyLight: ORIGIN_COLOR.LIGHT,
    sphereText: ORIGIN_COLOR.LIGHT,
    sphereTextOutline: ORIGIN_COLOR.DARK,
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}

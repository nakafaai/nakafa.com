import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import type { NarrowCameraPose } from "@repo/design-system/lib/geometry/camera";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { Array as Arr } from "effect";

export const CATHODE_RAY_MODE_ID = "cathode-ray";
export const GOLD_FOIL_MODE_ID = "gold-foil";
export const ATOM_MAP_MODE_ID = "atom-map";

export type SubatomicParticlesModeId =
  | typeof CATHODE_RAY_MODE_ID
  | typeof GOLD_FOIL_MODE_ID
  | typeof ATOM_MAP_MODE_ID;
export type SubatomicSceneColors = ReturnType<typeof getSubatomicSceneColors>;

export const SUBATOMIC_PARTICLE_MODE_IDS = [
  CATHODE_RAY_MODE_ID,
  GOLD_FOIL_MODE_ID,
  ATOM_MAP_MODE_ID,
] satisfies SubatomicParticlesModeId[];

export const SUBATOMIC_VIEW_CONFIG = {
  [CATHODE_RAY_MODE_ID]: {
    cameraPosition: [0, 0.1, 4.85],
    cameraTarget: [0, 0, 0],
    narrowCameraPosition: [0, 0.1, 5.4],
  },
  [GOLD_FOIL_MODE_ID]: {
    cameraPosition: [0, 0.05, 5.2],
    cameraTarget: [0, 0, 0],
    narrowCameraPosition: [0, 0.05, 5.4],
  },
  [ATOM_MAP_MODE_ID]: {
    cameraPosition: [0, 0.05, 4.8],
    cameraTarget: [0, 0, 0],
    narrowCameraPosition: [0, 0.05, 3.35],
  },
} satisfies Record<SubatomicParticlesModeId, NarrowCameraPose>;

export function isSubatomicParticlesModeId(
  value: string
): value is SubatomicParticlesModeId {
  return Arr.some(SUBATOMIC_PARTICLE_MODE_IDS, (modeId) => modeId === value);
}

/**
 * Chooses theme-aware colors for the 3D subatomic particle scenes.
 */
export function getSubatomicSceneColors(resolvedTheme: string | undefined) {
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";

  return {
    alpha: PLOT_COLORS.orange,
    anode: PLOT_COLORS.orange,
    cathode: PLOT_COLORS.slate,
    electron: PLOT_COLORS.violet,
    glass: getColor("SLATE", 300),
    gold: PLOT_COLORS.amber,
    groundLight: isDarkTheme ? PLOT_COLORS.slate : getColor("STONE"),
    negative: PLOT_COLORS.pink,
    neutron: PLOT_COLORS.slate,
    nucleus: PLOT_COLORS.pink,
    positive: PLOT_COLORS.fuchsia,
    proton: PLOT_COLORS.pink,
    ray: PLOT_COLORS.teal,
    sphereText: ORIGIN_COLOR.LIGHT,
    skyLight: ORIGIN_COLOR.LIGHT,
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}

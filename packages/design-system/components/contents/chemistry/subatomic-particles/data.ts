import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

export const CATHODE_RAY_MODE_ID = "cathode-ray";
export const GOLD_FOIL_MODE_ID = "gold-foil";
export const ATOM_MAP_MODE_ID = "atom-map";

export type SubatomicParticlesModeId =
  | typeof CATHODE_RAY_MODE_ID
  | typeof GOLD_FOIL_MODE_ID
  | typeof ATOM_MAP_MODE_ID;
export type SubatomicSceneColors = ReturnType<typeof getSubatomicSceneColors>;
export type SubatomicCameraPoint = readonly [number, number, number];

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
} satisfies Record<
  SubatomicParticlesModeId,
  {
    cameraPosition: SubatomicCameraPoint;
    cameraTarget: SubatomicCameraPoint;
    narrowCameraPosition: SubatomicCameraPoint;
  }
>;

export interface SubatomicParticlesFact {
  label: string;
  math?: boolean;
  value: string;
}

export interface SubatomicParticlesModeLabels {
  description: ReactNode;
  facts: readonly SubatomicParticlesFact[];
  tab: string;
}

export interface SubatomicParticlesSceneLabels {
  alphaParticle: string;
  anode: string;
  cathode: string;
  cathodeRay: string;
  negativePlate: string;
  nucleus: string;
  positivePlate: string;
}

export interface SubatomicParticlesLabLabels {
  chooseMode: string;
  modes: Record<SubatomicParticlesModeId, SubatomicParticlesModeLabels>;
  scene: SubatomicParticlesSceneLabels;
}

export interface SubatomicParticlesLabProps {
  description: ReactNode;
  labels: SubatomicParticlesLabLabels;
  title: ReactNode;
}

export function isSubatomicParticlesModeId(
  value: string
): value is SubatomicParticlesModeId {
  return SUBATOMIC_PARTICLE_MODE_IDS.some((modeId) => modeId === value);
}

/**
 * Chooses theme-aware colors for the 3D subatomic particle scenes.
 */
export function getSubatomicSceneColors(resolvedTheme: string | undefined) {
  const isDarkTheme = resolvedTheme === "dark";

  return {
    alpha: getColor("ORANGE"),
    anode: getColor("TEAL"),
    cathode: getColor("SLATE"),
    electron: getColor("SKY"),
    glass: getColor("CYAN"),
    gold: getColor("AMBER"),
    groundLight: isDarkTheme ? getColor("SLATE") : getColor("STONE"),
    negative: getColor("ROSE"),
    neutron: getColor("SLATE"),
    nucleus: getColor("ROSE"),
    positive: getColor("EMERALD"),
    proton: getColor("ROSE"),
    ray: getColor("CYAN"),
    sphereText: ORIGIN_COLOR.LIGHT,
    skyLight: ORIGIN_COLOR.LIGHT,
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}

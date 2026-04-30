import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

export const CHARGE_MODE_ID = "charge";
export const MASS_MODE_ID = "mass";
export const LOCATION_MODE_ID = "location";

export type SubatomicParticlePropertiesModeId =
  | typeof CHARGE_MODE_ID
  | typeof MASS_MODE_ID
  | typeof LOCATION_MODE_ID;
export type SubatomicParticlePropertiesColors = ReturnType<
  typeof getSubatomicParticlePropertiesColors
>;
export type SubatomicParticlePropertiesCameraPoint = readonly [
  number,
  number,
  number,
];

export const SUBATOMIC_PARTICLE_PROPERTIES_MODE_IDS = [
  CHARGE_MODE_ID,
  MASS_MODE_ID,
  LOCATION_MODE_ID,
] satisfies SubatomicParticlePropertiesModeId[];

export const SUBATOMIC_PARTICLE_PROPERTIES_VIEW_CONFIG = {
  [CHARGE_MODE_ID]: {
    cameraPosition: [0, 0.08, 4.45],
    cameraTarget: [0, 0, 0],
    narrowCameraPosition: [0, 0.08, 4.85],
  },
  [MASS_MODE_ID]: {
    cameraPosition: [0, 0.18, 3.65],
    cameraTarget: [0, 0, 0],
    narrowCameraPosition: [0, 0.2, 3.95],
  },
  [LOCATION_MODE_ID]: {
    cameraPosition: [0, 0.08, 4.25],
    cameraTarget: [0, 0, 0],
    narrowCameraPosition: [0, 0.08, 4.35],
  },
} satisfies Record<
  SubatomicParticlePropertiesModeId,
  {
    cameraPosition: SubatomicParticlePropertiesCameraPoint;
    cameraTarget: SubatomicParticlePropertiesCameraPoint;
    narrowCameraPosition: SubatomicParticlePropertiesCameraPoint;
  }
>;

export interface SubatomicParticlePropertiesFact {
  label: string;
  math?: boolean;
  value: string;
}

export interface SubatomicParticlePropertiesModeLabels {
  facts: readonly SubatomicParticlePropertiesFact[];
  summary: ReactNode;
  tab: string;
}

export interface SubatomicParticlePropertiesSceneLabels {
  electron: string;
  electronRegion: string;
  negativePlate: string;
  neutron: string;
  nucleus: string;
  positivePlate: string;
  proton: string;
}

export interface SubatomicParticlePropertiesLabLabels {
  chooseMode: string;
  modes: Record<
    SubatomicParticlePropertiesModeId,
    SubatomicParticlePropertiesModeLabels
  >;
  scene: SubatomicParticlePropertiesSceneLabels;
}

export interface SubatomicParticlePropertiesLabProps {
  description: ReactNode;
  labels: SubatomicParticlePropertiesLabLabels;
  title: ReactNode;
}

/**
 * Narrows ToggleGroup string values to the available particle-property modes.
 */
export function isSubatomicParticlePropertiesModeId(
  value: string
): value is SubatomicParticlePropertiesModeId {
  return SUBATOMIC_PARTICLE_PROPERTIES_MODE_IDS.some(
    (modeId) => modeId === value
  );
}

/**
 * Chooses theme-aware colors for particle-property scenes.
 */
export function getSubatomicParticlePropertiesColors(
  resolvedTheme: string | undefined
) {
  const isDarkTheme = resolvedTheme === "dark";

  return {
    electron: getColor("SKY"),
    electronPath: getColor("CYAN"),
    groundLight: isDarkTheme ? getColor("SLATE") : getColor("STONE"),
    neutral: getColor("SLATE"),
    neutron: getColor("SLATE"),
    negativePlate: getColor("ROSE"),
    nucleus: getColor("AMBER"),
    positivePlate: getColor("EMERALD"),
    proton: getColor("ROSE"),
    protonPath: getColor("ROSE"),
    sphereText: ORIGIN_COLOR.LIGHT,
    skyLight: ORIGIN_COLOR.LIGHT,
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}

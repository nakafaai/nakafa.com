import type { CoordinateTuple as ScenePoint } from "@repo/design-system/components/three/frame";
import { getColor } from "@repo/design-system/lib/color";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import type { ReactNode } from "react";

export const CAMERA_POSITION = [0, 2.35, 5.5] satisfies ScenePoint;
export const NARROW_CAMERA_POSITION = [0, 2.75, 7.8] satisfies ScenePoint;
export const CAMERA_TARGET = [0, 0.8, 0] satisfies ScenePoint;

export type VectorConceptSceneColors = ReturnType<typeof getSceneColors>;

export interface VectorConceptLabLabels {
  bridgeView: string;
  chooseLoadPosition: string;
  direction: string;
  directionValue: string;
  leftCable: ReactNode;
  magnitude: string;
  magnitudeValue: string;
  netIdea: string;
  netIdeaValue: string;
  rightCable: ReactNode;
}

export interface VectorConceptLabProps {
  description: ReactNode;
  labels: VectorConceptLabLabels;
  title: ReactNode;
}

export function formatSigned(value: number) {
  if (value === 0) {
    return "0";
  }

  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

export function getSceneColors(resolvedTheme: string | undefined) {
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";

  return {
    cable: isDarkTheme ? getColor("ZINC") : getColor("SLATE"),
    deck: isDarkTheme ? getColor("STONE") : getColor("ZINC"),
    groundLight: isDarkTheme ? getColor("SLATE") : getColor("STONE"),
    leftVector: getColor("TEAL"),
    load: getColor("AMBER"),
    loadDetail: getColor("ORANGE"),
    rightVector: getColor("VIOLET"),
    skyLight: getColor("ZINC", 100),
    text: isDarkTheme ? getColor("ZINC", 100) : getColor("ZINC", 900),
    tower: isDarkTheme ? getColor("GRAY") : getColor("SLATE"),
    wheel: isDarkTheme ? getColor("ZINC", 950) : getColor("ZINC", 900),
  };
}

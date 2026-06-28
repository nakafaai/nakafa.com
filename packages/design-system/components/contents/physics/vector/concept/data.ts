import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";
import { Vector3 } from "three";

export const LOAD_MIN_X = -1.2;
export const LOAD_MAX_X = 1.2;
export const LOAD_STEP = 0.1;
export const CAMERA_POSITION = [0, 2.35, 5.5] satisfies ScenePoint;
export const NARROW_CAMERA_POSITION = [0, 2.75, 7.8] satisfies ScenePoint;
export const CAMERA_TARGET = [0, 0.8, 0] satisfies ScenePoint;

const LOAD_WEIGHT_NEWTON = 120;
const LABEL_INNER_OFFSET = 0.28;
const LABEL_TOWER_LIFT = 0.28;
const LABEL_Z_OFFSET = 0.34;

export type ScenePoint = readonly [number, number, number];
export type VectorConceptSceneColors = ReturnType<typeof getSceneColors>;
export type VectorConceptState = ReturnType<typeof getVectorState>;

export interface VectorConceptLabLabels {
  bridgeView: string;
  chooseLoadPosition: string;
  direction: string;
  directionValue: string;
  leftCable: string;
  magnitude: string;
  magnitudeValue: string;
  netIdea: string;
  netIdeaValue: string;
  rightCable: string;
}

export interface VectorConceptLabProps {
  description: ReactNode;
  labels: VectorConceptLabLabels;
  title: ReactNode;
}

export function getVectorState(loadX: number) {
  const loadPoint = [loadX, 0.3, 0] satisfies ScenePoint;
  const leftAnchor = [-2.15, 2.2, 0] satisfies ScenePoint;
  const rightAnchor = [2.15, 2.2, 0] satisfies ScenePoint;
  const left = getCableVector(loadPoint, leftAnchor);
  const right = getCableVector(loadPoint, rightAnchor);
  const leftTension =
    LOAD_WEIGHT_NEWTON /
    (left.sin + (left.cos * right.sin) / Math.max(right.cos, 0.001));
  const rightTension = (leftTension * left.cos) / Math.max(right.cos, 0.001);

  return {
    loadPoint,
    left: getCableDisplay(loadPoint, left, leftAnchor, leftTension),
    right: getCableDisplay(loadPoint, right, rightAnchor, rightTension),
  };
}

export function formatSigned(value: number) {
  if (value === 0) {
    return "0";
  }

  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

export function getSceneColors(resolvedTheme: string | undefined) {
  const isDarkTheme = resolvedTheme === "dark";

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

function getCableVector(start: ScenePoint, end: ScenePoint) {
  const direction = new Vector3().subVectors(
    new Vector3(...end),
    new Vector3(...start)
  );
  const horizontalLength = Math.hypot(direction.x, direction.z);
  const length = direction.length();

  return {
    direction: direction.normalize(),
    cos: horizontalLength / length,
    sin: direction.y / length,
  };
}

function getCableDisplay(
  start: ScenePoint,
  cable: ReturnType<typeof getCableVector>,
  anchor: ScenePoint,
  tension: number
) {
  const visualLength = 0.55 + tension / 150;
  const arrowEndVector = cable.direction.clone().multiplyScalar(visualLength);

  return {
    anchor,
    arrowEnd: [
      start[0] + arrowEndVector.x,
      start[1] + arrowEndVector.y,
      start[2] + arrowEndVector.z,
    ] satisfies ScenePoint,
    labelPoint: getCableLabelPoint(anchor),
    tension,
  };
}

function getCableLabelPoint(anchor: ScenePoint) {
  const side = Math.sign(anchor[0]) || 1;

  return [
    anchor[0] - side * LABEL_INNER_OFFSET,
    anchor[1] + LABEL_TOWER_LIFT,
    anchor[2] + LABEL_Z_OFFSET,
  ] satisfies ScenePoint;
}

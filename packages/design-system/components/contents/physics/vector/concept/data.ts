import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";
import { Vector3 } from "three";

export const LOAD_MIN_X = -1.2;
export const LOAD_MAX_X = 1.2;
export const LOAD_STEP = 0.1;
export const CAMERA_POSITION = [0, 2.35, 5.5] satisfies ScenePoint;
export const NARROW_CAMERA_POSITION = [0, 2.65, 6.5] satisfies ScenePoint;
export const CAMERA_TARGET = [0, 0.8, 0] satisfies ScenePoint;

const LOAD_WEIGHT_NEWTON = 120;
const LABEL_OFFSET = 0.44;
const LABEL_VECTOR_RATIO = 0.56;

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
    rightVector: getColor("VIOLET"),
    skyLight: "#f4f4f5",
    text: isDarkTheme ? "#f4f4f5" : "#18181b",
    tower: isDarkTheme ? getColor("GRAY") : getColor("SLATE"),
    water: getColor("CYAN"),
    wheel: isDarkTheme ? "#09090b" : "#18181b",
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
    labelPoint: getCableLabelPoint(start, arrowEndVector, cable.direction),
    tension,
  };
}

function getCableLabelPoint(
  start: ScenePoint,
  arrowEndVector: Vector3,
  direction: Vector3
) {
  const basePoint = new Vector3(...start).add(
    arrowEndVector.clone().multiplyScalar(LABEL_VECTOR_RATIO)
  );
  const perpendicular = new Vector3(-direction.y, direction.x, 0).normalize();

  if (direction.x > 0) {
    perpendicular.multiplyScalar(-1);
  }

  const labelPoint = basePoint.add(perpendicular.multiplyScalar(LABEL_OFFSET));

  return [labelPoint.x, labelPoint.y, labelPoint.z] satisfies ScenePoint;
}

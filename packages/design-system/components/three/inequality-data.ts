import type { ThreeFontSize } from "@repo/design-system/components/three/data/constants";
import { isMobileDevice } from "@repo/design-system/lib/device";
import type { ReactNode } from "react";
import type { Color } from "three";

const MIN_CORES_FOR_HIGH_RESOLUTION = 8;
const MIN_CORES_FOR_MEDIUM_RESOLUTION = 4;
const MAX_MOBILE_OR_LOW_CORE_RESOLUTION = 50;
const MAX_MEDIUM_CORE_RESOLUTION = 100;

export const DEFAULT_INEQUALITY_RANGE_MIN = -5;
export const DEFAULT_INEQUALITY_RANGE_MAX = 5;

export interface InequalityLabel {
  color?: string | Color;
  fontSize?: ThreeFontSize | number;
  position: [number, number, number];
  text: ReactNode;
}

export interface InequalityProps {
  boundaryColor?: string | Color;
  boundaryFunction?: (x: number, y: number) => number;
  /** Coefficients `[a, b, c]` for the boundary `ax + by + c = 0`. */
  boundaryLine2D?: [number, number, number];
  boundaryLineWidth?: number;
  color?: string | Color;
  is2D?: boolean;
  label?: InequalityLabel;
  opacity?: number;
  resolution?: number;
  showBoundary?: boolean;
  xRange?: [number, number];
  yRange?: [number, number];
  zRange?: [number, number];
}

/**
 * Adapts inequality mesh resolution to the device budget while honoring the
 * caller's requested upper bound.
 */
export function getAdaptiveInequalityResolution(requestedResolution: number) {
  const processorCount =
    navigator.hardwareConcurrency || MIN_CORES_FOR_MEDIUM_RESOLUTION;

  if (isMobileDevice() || processorCount < MIN_CORES_FOR_MEDIUM_RESOLUTION) {
    return Math.min(requestedResolution, MAX_MOBILE_OR_LOW_CORE_RESOLUTION);
  }

  if (processorCount >= MIN_CORES_FOR_HIGH_RESOLUTION) {
    return requestedResolution;
  }

  return Math.min(requestedResolution, MAX_MEDIUM_CORE_RESOLUTION);
}

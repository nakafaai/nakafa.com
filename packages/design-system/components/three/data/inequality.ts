import { isMobileDevice } from "@repo/design-system/lib/device";

const MIN_CORES_FOR_HIGH_RESOLUTION = 8;
const MIN_CORES_FOR_MEDIUM_RESOLUTION = 4;
const MAX_MOBILE_OR_LOW_CORE_RESOLUTION = 50;
const MAX_MEDIUM_CORE_RESOLUTION = 100;

export const DEFAULT_INEQUALITY_RANGE_MIN = -5;
export const DEFAULT_INEQUALITY_RANGE_MAX = 5;

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

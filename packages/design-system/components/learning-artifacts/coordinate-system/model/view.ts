import {
  type CoordinateSystemArtifact,
  type CoordinateSystemPayloadEncoded,
  encodeCoordinateSystemArtifact,
} from "@repo/math/schema/artifact/schema";
import { readScalarNumber } from "./numeric";

const DEFAULT_AXIS_SIZE = 10;
const MAX_AXIS_SIZE = 1000;
const MAX_CAMERA_CENTER = 1000;
const MIN_AXIS_SIZE = 5;
const MIN_GRID_DIVISIONS = 20;

export type CoordinateSystemPayloadView = CoordinateSystemPayloadEncoded;
export type CoordinatePrimitiveView =
  CoordinateSystemPayloadView["primitives"][number];
export type RenderSamplingPolicyView = CoordinateSystemPayloadView["sampling"];
export type CoordinateArtifactView = ReturnType<typeof readCoordinateView>;

/**
 * Encodes schema-class artifacts into plain data before the client boundary.
 */
export function readCoordinateView(artifact: CoordinateSystemArtifact) {
  const encodedArtifact = encodeCoordinateSystemArtifact(artifact);

  return {
    artifact: encodedArtifact,
    viewport: readArtifactViewport(encodedArtifact.payload),
  };
}

/**
 * Derives a stable camera and grid frame from artifact-owned exact axes.
 */
export function readArtifactViewport(payload: CoordinateSystemPayloadView) {
  const axisSize = readAxisSize(payload);
  const center = {
    x: readAxisCenter(payload.axes.x),
    y: readAxisCenter(payload.axes.y),
    z: readAxisCenter(payload.axes.z),
  };

  return {
    axisSize,
    cameraX: center.x + axisSize * 1.25,
    cameraY: center.y + axisSize * 0.85,
    cameraZ: center.z + axisSize * 1.25,
    gridDivisions: Math.max(MIN_GRID_DIVISIONS, axisSize * 4),
    targetX: center.x,
    targetY: center.y,
    targetZ: center.z,
  };
}

/**
 * Computes a stable viewport size from exact axis ranges in the payload.
 */
function readAxisSize(payload: CoordinateSystemPayloadView) {
  const extents = [
    readAxisExtent(payload.axes.x),
    readAxisExtent(payload.axes.y),
    readAxisExtent(payload.axes.z),
  ];

  return Math.min(
    MAX_AXIS_SIZE,
    Math.max(MIN_AXIS_SIZE, Math.ceil(Math.max(...extents)))
  );
}

/**
 * Reads the largest absolute coordinate needed to frame one axis.
 */
function readAxisExtent(axis: CoordinateSystemPayloadView["axes"]["x"]) {
  const min = readScalarNumber(axis[0]);
  const max = readScalarNumber(axis[1]);

  if (min === undefined || max === undefined) {
    return DEFAULT_AXIS_SIZE;
  }

  return Math.max(Math.abs(min), Math.abs(max));
}

/**
 * Centers the camera target on the artifact instead of the global origin.
 */
function readAxisCenter(axis: CoordinateSystemPayloadView["axes"]["x"]) {
  const min = readScalarNumber(axis[0]);
  const max = readScalarNumber(axis[1]);

  if (min === undefined || max === undefined) {
    return 0;
  }

  const center = (min + max) / 2;
  if (!Number.isFinite(center)) {
    return 0;
  }

  return Math.max(-MAX_CAMERA_CENTER, Math.min(MAX_CAMERA_CENTER, center));
}

import { resolveCameraFit } from "@repo/design-system/lib/geometry/camera/fit";
import { Array as Arr, Effect } from "effect";
import type { Box2, Box3, Vector3 } from "three";

const DEFAULT_CAMERA_X = 12;
const DEFAULT_CAMERA_Y = 8;
const DEFAULT_CAMERA_Z = 12;
const DEFAULT_TARGET_X = 0;
const DEFAULT_TARGET_Y = 0;
const DEFAULT_TARGET_Z = 0;

/** Default camera position when a scene omits an explicit authored pose. */
export const DEFAULT_CAMERA_POSITION = [
  DEFAULT_CAMERA_X,
  DEFAULT_CAMERA_Y,
  DEFAULT_CAMERA_Z,
] satisfies readonly [number, number, number];

/** Default camera look-at target when a scene omits an explicit authored target. */
export const DEFAULT_CAMERA_TARGET = [
  DEFAULT_TARGET_X,
  DEFAULT_TARGET_Y,
  DEFAULT_TARGET_Z,
] satisfies readonly [number, number, number];

/** Measured label bounds included in a camera fit cache key. */
interface MeasuredCameraLabel {
  readonly anchors: Box3;
  readonly gap: { readonly x: number; readonly y: number };
  readonly rectangle: Box2;
}

/**
 * Serializes every measurement and projection input that invalidates a content
 * camera fit so unchanged redraws keep the user's current camera pose.
 */
export function cameraFitKey(input: {
  readonly authoredPosition: Vector3;
  readonly authoredTarget: Vector3;
  readonly bounds: Box3;
  readonly labels: readonly MeasuredCameraLabel[];
  readonly maxDistance: number | undefined;
  readonly minDistance: number | undefined;
  readonly projectionFar: number | undefined;
  readonly projectionFov: number;
  readonly projectionHeight: number;
  readonly projectionNear: number | undefined;
  readonly viewportHeight: number;
  readonly viewportWidth: number;
}): string {
  // Each part is written the way join writes it: undefined becomes an empty string.
  return Arr.join(
    Arr.map(
      [
        ...input.bounds.min.toArray(),
        ...input.bounds.max.toArray(),
        ...Arr.flatMap(input.labels, (label) => [
          ...label.anchors.min.toArray(),
          ...label.anchors.max.toArray(),
          label.gap.x,
          label.gap.y,
          ...label.rectangle.min.toArray(),
          ...label.rectangle.max.toArray(),
        ]),
        ...input.authoredPosition.toArray(),
        ...input.authoredTarget.toArray(),
        input.viewportWidth,
        input.viewportHeight,
        input.projectionFov,
        input.projectionHeight,
        input.projectionNear,
        input.projectionFar,
        input.minDistance,
        input.maxDistance,
      ],
      (part) => String(part ?? "")
    ),
    ","
  );
}

/**
 * Fits finite scene bounds with fixed-pixel labels, falling back to geometry
 * bounds alone when narrow viewports cannot satisfy every pixel label margin.
 */
export function resolveSafeCameraFit(
  input: Parameters<typeof resolveCameraFit>[0]
) {
  return Effect.runSync(
    resolveCameraFit(input).pipe(
      Effect.catchTag("CameraLabelFitError", () =>
        resolveCameraFit({ ...input, labels: [] })
      ),
      Effect.orDie
    )
  );
}

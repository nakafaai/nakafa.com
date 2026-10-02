/** Pure camera projection contract shared by view math and React renderers. */
export type CameraProjection =
  | {
      readonly far?: number;
      readonly fov?: number;
      readonly kind: "perspective";
      readonly near?: number;
    }
  | {
      readonly far?: number;
      readonly kind: "orthographic";
      readonly near?: number;
      /** Visible world height; a content fit may expand it when requested. */
      readonly viewHeight?: number;
    };

// Zooming out must retain at least two thirds of the scene's initial scale.
const MINIMUM_INITIAL_SCALE = 2 / 3;
const MAXIMUM_INITIAL_SCALE = 4;

interface CameraFraming {
  readonly maxDistance?: number | undefined;
  readonly minDistance?: number | undefined;
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

/** Bounds perspective dollying around the current scene's initial framing. */
export function resolveCameraDistanceLimits({
  maxDistance,
  minDistance,
  position,
  target,
}: CameraFraming) {
  const initialDistance = Math.hypot(
    position[0] - target[0],
    position[1] - target[1],
    position[2] - target[2]
  );
  const farthestDistance = initialDistance / MINIMUM_INITIAL_SCALE;

  return {
    maxDistance: Math.max(
      initialDistance,
      Math.min(maxDistance ?? farthestDistance, farthestDistance)
    ),
    minDistance: Math.min(
      initialDistance,
      Math.max(minDistance ?? 0, initialDistance / MAXIMUM_INITIAL_SCALE)
    ),
  };
}

/** Keeps orthographic zoom bounds in world units when the canvas resizes. */
export function resolveOrthographicZoom(
  viewHeight: number,
  canvasHeight: number
) {
  const zoom = canvasHeight / viewHeight;

  return {
    maxZoom: zoom * MAXIMUM_INITIAL_SCALE,
    minZoom: zoom * MINIMUM_INITIAL_SCALE,
    zoom,
  };
}

/**
 * Frames an authored camera pose on a canvas of any shape. Authored poses are
 * written for square or wider frames, so on a portrait canvas, such as a phone
 * showing a scene full screen, the view keeps the horizontal extent a square
 * frame shows and gains room above and below instead of losing its sides.
 *
 * Returns the vertical field of view in degrees for a perspective camera, and
 * the canvas extent in pixels that an orthographic view height spans.
 */
export function resolveAuthoredView({
  fov,
  height,
  width,
}: {
  fov: number;
  height: number;
  width: number;
}) {
  const aspect = width / height;
  if (aspect >= 1) {
    return { extent: height, fov };
  }
  const halfFov = (fov * Math.PI) / 360;

  return {
    extent: width,
    fov: (Math.atan(Math.tan(halfFov) / aspect) * 360) / Math.PI,
  };
}

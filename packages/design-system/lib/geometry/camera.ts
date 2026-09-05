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
      readonly viewHeight: number;
    };

// Zooming out must retain at least two thirds of the scene's initial scale.
const MINIMUM_INITIAL_SCALE = 2 / 3;
const MAXIMUM_INITIAL_SCALE = 4;

interface CameraFraming {
  readonly maxDistance?: number;
  readonly minDistance?: number;
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

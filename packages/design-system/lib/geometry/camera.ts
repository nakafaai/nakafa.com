import { Schema } from "effect";

/** Pure camera projection contract shared by view math and React renderers. */
const CameraProjectionSchema = Schema.Union([
  Schema.Struct({
    far: Schema.optionalKey(Schema.Finite),
    fov: Schema.optionalKey(Schema.Finite),
    kind: Schema.Literal("perspective"),
    near: Schema.optionalKey(Schema.Finite),
  }),
  Schema.Struct({
    far: Schema.optionalKey(Schema.Finite),
    kind: Schema.Literal("orthographic"),
    near: Schema.optionalKey(Schema.Finite),
    /** Visible world height; a content fit may expand it when requested. */
    viewHeight: Schema.optionalKey(Schema.Finite),
  }),
]);

export type CameraProjection = typeof CameraProjectionSchema.Type;

/** A point in the scene's world space. */
const ScenePointSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);

/** A scene's initial camera pose and its authored dolly limits. */
const CameraFramingSchema = Schema.Struct({
  maxDistance: Schema.optional(Schema.Finite),
  minDistance: Schema.optional(Schema.Finite),
  position: ScenePointSchema,
  target: ScenePointSchema,
});

/**
 * A canvas an authored pose is framed on: its size in pixels and the pose's
 * vertical field of view in degrees.
 */
const AuthoredViewSchema = Schema.Struct({
  fov: Schema.Finite,
  height: Schema.Finite,
  width: Schema.Finite,
});

// Zooming out must retain at least two thirds of the scene's initial scale.
const MINIMUM_INITIAL_SCALE = 2 / 3;
const MAXIMUM_INITIAL_SCALE = 4;

/** Bounds perspective dollying around the current scene's initial framing. */
export function resolveCameraDistanceLimits({
  maxDistance,
  minDistance,
  position,
  target,
}: typeof CameraFramingSchema.Type) {
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
}: typeof AuthoredViewSchema.Type) {
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

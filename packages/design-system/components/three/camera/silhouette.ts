import type { CameraPixelLabel } from "@repo/design-system/lib/geometry/camera/bounds";
import { Array as Arr, Match, Option, Schema } from "effect";
import type { Matrix4, Object3D } from "three";
import { Box3, Vector3 } from "three";

const PointSchema = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);

const CameraRoundSchema = Schema.Union([
  Schema.Struct({
    center: PointSchema,
    kind: Schema.Literal("sphere"),
    radius: Schema.Finite,
  }),
  Schema.Struct({
    center: PointSchema,
    kind: Schema.Literal("ring"),
    /** The direction the flat circle faces, of any length. */
    normal: PointSchema,
    radius: Schema.Finite,
  }),
]);

/**
 * A round subject in its own local space: a ball, or a ring, which is a flat
 * circle such as an orbit, a wheel rim or a dial.
 */
export type CameraRound = typeof CameraRoundSchema.Type;

const CameraSilhouetteSchema = Schema.Union([
  Schema.Struct({ box: Schema.instanceOf(Box3), kind: Schema.Literal("box") }),
  Schema.Struct({
    center: Schema.instanceOf(Vector3),
    kind: Schema.Literal("sphere"),
    radius: Schema.Finite,
  }),
  Schema.Struct({
    center: Schema.instanceOf(Vector3),
    kind: Schema.Literal("ring"),
    normal: Schema.instanceOf(Vector3),
    radius: Schema.Finite,
  }),
]);

/** A convex world-space outline the camera fits by its true projected edge. */
export type CameraSilhouette = typeof CameraSilhouetteSchema.Type;

/**
 * Rebuilds a declared round subject from its plain numbers, so a component can
 * compare it by value. Nothing is declared without a radius and a centre; a
 * normal makes it a ring.
 */
export function roundOf(
  radius: number | undefined,
  [centerX, centerY, centerZ]: readonly (number | undefined)[],
  [normalX, normalY, normalZ]: readonly (number | undefined)[]
): CameraRound | undefined {
  if (
    radius === undefined ||
    centerX === undefined ||
    centerY === undefined ||
    centerZ === undefined
  ) {
    return;
  }
  const center = [centerX, centerY, centerZ] as const;
  if (normalX === undefined || normalY === undefined || normalZ === undefined) {
    return { center, kind: "sphere", radius };
  }
  return { center, kind: "ring", normal: [normalX, normalY, normalZ], radius };
}

/** Moves a round subject from its own local space into the world. */
function placeCameraRound(
  round: CameraRound,
  matrix: Matrix4
): CameraSilhouette {
  const center = new Vector3(...round.center).applyMatrix4(matrix);
  const radius = round.radius * matrix.getMaxScaleOnAxis();
  return Match.value(round).pipe(
    Match.discriminatorsExhaustive("kind")({
      ring: ({ normal }): CameraSilhouette => ({
        center,
        kind: "ring",
        normal: new Vector3(...normal).transformDirection(matrix),
        radius,
      }),
      sphere: (): CameraSilhouette => ({ center, kind: "sphere", radius }),
    })
  );
}

/** Whether a round subject is drawn: neither it nor any group above it is hidden. */
function roundShown(object: Object3D): boolean {
  return (
    object.visible && (object.parent === null || roundShown(object.parent))
  );
}

/**
 * What the camera frames now: the measured geometry with its fixed-pixel
 * labels, and the world outline of every round subject that is drawn. Read
 * after the scene's world matrices are up to date.
 */
export function framedContent(
  measurement: Option.Option<{
    readonly bounds: Box3;
    readonly labels: readonly CameraPixelLabel[];
  }>,
  rounds: Iterable<
    readonly [
      number,
      { readonly object: Object3D; readonly round: CameraRound },
    ]
  >
) {
  const placed = Arr.map(
    Arr.filter(Arr.fromIterable(rounds), ([, { object }]) =>
      roundShown(object)
    ),
    ([, { object, round }]) => placeCameraRound(round, object.matrixWorld)
  );
  return Option.match(measurement, {
    onNone: () => ({ labels: [], silhouettes: placed }),
    onSome: ({ bounds, labels }) => ({
      labels,
      silhouettes: [{ box: bounds, kind: "box" as const }, ...placed],
    }),
  });
}

/** The world box that holds a silhouette, for clip planes and pan limits. */
export function silhouetteBounds(silhouette: CameraSilhouette) {
  return Match.value(silhouette).pipe(
    Match.discriminatorsExhaustive("kind")({
      box: ({ box }) => box.clone(),
      ring: ({ center, normal, radius }) => {
        // A circle reaches radius * sqrt(1 - n^2) along each world axis.
        const reach = new Vector3(
          Math.sqrt(Math.max(0, 1 - normal.x ** 2)),
          Math.sqrt(Math.max(0, 1 - normal.y ** 2)),
          Math.sqrt(Math.max(0, 1 - normal.z ** 2))
        ).multiplyScalar(radius);
        return new Box3(center.clone().sub(reach), center.clone().add(reach));
      },
      sphere: ({ center, radius }) =>
        new Box3().setFromCenterAndSize(
          center,
          new Vector3().setScalar(2 * radius)
        ),
    })
  );
}

/**
 * How far a silhouette reaches from `origin` along `direction`, which may have
 * any length: the support of the outline, which is what a frame edge touches.
 */
export function silhouetteReach(
  silhouette: CameraSilhouette,
  direction: Vector3,
  origin: Vector3
) {
  return Match.value(silhouette).pipe(
    Match.discriminatorsExhaustive("kind")({
      box: ({ box }) => {
        const half = box.getSize(new Vector3()).multiplyScalar(0.5);
        return (
          box.getCenter(new Vector3()).sub(origin).dot(direction) +
          half.x * Math.abs(direction.x) +
          half.y * Math.abs(direction.y) +
          half.z * Math.abs(direction.z)
        );
      },
      ring: ({ center, normal, radius }) =>
        center.clone().sub(origin).dot(direction) +
        radius *
          Math.sqrt(
            Math.max(0, direction.lengthSq() - direction.dot(normal) ** 2)
          ),
      sphere: ({ center, radius }) =>
        center.clone().sub(origin).dot(direction) + radius * direction.length(),
    })
  );
}

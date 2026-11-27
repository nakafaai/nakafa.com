import type {
  CameraLabelBounds,
  CameraSubjectBounds,
} from "@repo/design-system/lib/geometry/camera/bounds";
import { measureCameraBounds } from "@repo/design-system/lib/geometry/camera/bounds";
import { Array as Arr, Effect, HashMap, Match, Option, Schema } from "effect";
import type { Matrix4 } from "three";
import { Box3, Object3D, Vector3 } from "three";

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

const CameraRoundEntrySchema = Schema.Struct({
  object: Schema.instanceOf(Object3D),
  round: CameraRoundSchema,
});

/** A registered round subject with the scene object that carries it. */
export type CameraRoundEntry = typeof CameraRoundEntrySchema.Type;

const CameraSilhouetteSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("hull"),
    points: Schema.Array(Schema.instanceOf(Vector3)),
  }),
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

/**
 * A convex world-space outline the camera fits by its true projected edge: the
 * hull of measured points, a ball, or a ring.
 */
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
 * Measures what the camera frames now: the scene's finite geometry with its
 * fixed-pixel labels, and the world outline of every round subject that is
 * drawn. The geometry is one box round everything measured.
 */
export const measureContent = Effect.fn("camera.measureContent")(function* ({
  labels,
  position,
  root,
  rounds,
  subjects,
  target,
}: {
  readonly labels: Iterable<readonly [number, CameraLabelBounds]>;
  readonly position: Vector3;
  readonly root: Object3D;
  readonly rounds: Iterable<readonly [number, CameraRoundEntry]>;
  readonly subjects: Iterable<readonly [number, CameraSubjectBounds]>;
  readonly target: Vector3;
}) {
  const measurement = yield* measureCameraBounds({
    labels: HashMap.fromIterable(labels),
    position,
    root,
    subjects: HashMap.fromIterable(subjects),
    target,
  });
  // The measurement has just brought every world matrix up to date.
  const placed = Arr.map(
    Arr.filter(Arr.fromIterable(rounds), ([, { object }]) =>
      roundShown(object)
    ),
    ([, { object, round }]) => placeCameraRound(round, object.matrixWorld)
  );
  return Option.match(measurement, {
    onNone: () => ({ labels: [], silhouettes: placed }),
    onSome: (measured) => ({
      labels: measured.labels,
      silhouettes: [
        { kind: "hull" as const, points: measured.corners },
        ...placed,
      ],
    }),
  });
});

/** The world box that holds a silhouette, for clip planes and pan limits. */
export function silhouetteBounds(silhouette: CameraSilhouette) {
  return Match.value(silhouette).pipe(
    Match.discriminatorsExhaustive("kind")({
      hull: ({ points }) => new Box3().setFromPoints(points),
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
      hull: ({ points }) => {
        let reach = Number.NEGATIVE_INFINITY;
        for (const point of points) {
          reach = Math.max(
            reach,
            (point.x - origin.x) * direction.x +
              (point.y - origin.y) * direction.y +
              (point.z - origin.z) * direction.z
          );
        }
        return reach;
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

import { CoordinateFrameSchema } from "@repo/design-system/components/three/frame";
import { Array as Arr, Effect, MutableHashMap, Option, Schema } from "effect";
import {
  Box2,
  Box3,
  InstancedMesh,
  Line,
  Matrix4,
  Mesh,
  type Object3D,
  Points,
  Vector2,
  Vector3,
} from "three";

const CameraLabelBoundsSchema = Schema.Struct({
  anchorX: Schema.Finite,
  anchorY: Schema.Finite,
  gap: Schema.Struct({ x: Schema.Finite, y: Schema.Finite }),
  height: Schema.Finite,
  pixels: Schema.optionalKey(
    Schema.Struct({ width: Schema.Finite, height: Schema.Finite })
  ),
  rotation: Schema.Finite,
  width: Schema.Finite,
});
export type CameraLabelBounds = typeof CameraLabelBoundsSchema.Type;

/** A fixed pixel rectangle follows an anchor's complete world-space envelope. */
const CameraPixelLabelSchema = Schema.Struct({
  anchors: Schema.instanceOf(Box3),
  gap: Schema.Struct({ x: Schema.Finite, y: Schema.Finite }),
  rectangle: Schema.instanceOf(Box2),
});
export type CameraPixelLabel = typeof CameraPixelLabelSchema.Type;

const CameraMeasurementSchema = Schema.Struct({
  bounds: Schema.instanceOf(Box3),
  labels: Schema.Array(CameraPixelLabelSchema),
});
type CameraMeasurement = typeof CameraMeasurementSchema.Type;

const CameraMotionBoundsSchema = Schema.Struct({
  rotation: Schema.optional(Schema.Literals(["x", "y", "z", "all"])),
  scale: Schema.optional(Schema.Finite),
  translation: Schema.optional(CoordinateFrameSchema),
});
export type CameraMotionBounds = typeof CameraMotionBoundsSchema.Type;

export type CameraSubjectBounds = Box3 | false | CameraMotionBounds;

/**
 * Samples finite scene geometry at a React or viewport update boundary.
 * Explicit subjects own an entire animation envelope; false excludes decoration.
 * HTML rectangles are camera-facing world extents, so rich math participates in
 * the same fit without duplicating or flattening its rendered content.
 */
export const measureCameraBounds = Effect.fn("camera.measureBounds")(
  function* ({
    labels,
    position,
    root,
    subjects,
    target,
  }: {
    labels: MutableHashMap.MutableHashMap<string, CameraLabelBounds>;
    position: Vector3;
    root: Object3D;
    subjects: MutableHashMap.MutableHashMap<string, CameraSubjectBounds>;
    target: Vector3;
  }) {
    const basis = new Matrix4().lookAt(position, target, new Vector3(0, 1, 0));
    const right = new Vector3().setFromMatrixColumn(basis, 0);
    const up = new Vector3().setFromMatrixColumn(basis, 1);
    yield* Effect.sync(() => root.updateWorldMatrix(true, true));

    const visit = Effect.fn("camera.measureSubjectBounds")(function* (
      object: Object3D,
      parent: Matrix4
    ): Effect.fn.Return<CameraMeasurement> {
      const subject = Option.getOrUndefined(
        MutableHashMap.get(subjects, object.uuid)
      );
      if (!object.visible || subject === false) {
        return { bounds: new Box3(), labels: [] };
      }

      const matrix = parent.clone().multiply(object.matrix);
      if (subject instanceof Box3) {
        return {
          bounds: new Box3().copy(subject).applyMatrix4(matrix),
          labels: [],
        };
      }
      if (subject) {
        const children = yield* Effect.forEach(object.children, (child) =>
          visit(child, new Matrix4())
        );
        const bounds = new Box3();
        for (const child of children) {
          bounds.union(motionEnvelope(child.bounds, subject));
        }
        const labels = Arr.flatMap(children, (child) =>
          child.labels.map((label) => ({
            ...label,
            anchors: motionEnvelope(label.anchors, subject),
          }))
        );
        return transformMeasurement({ bounds, labels }, parent);
      }

      const bounds = new Box3();
      bounds.union(yield* measureGeometryBounds(object, matrix));

      const label = Option.getOrUndefined(
        MutableHashMap.get(labels, object.uuid)
      );
      if (label) {
        bounds.union(labelBounds(label, matrix, right, up));
      }
      const ownLabels = label?.pixels
        ? [pixelLabelBounds(label, label.pixels, matrix)]
        : [];

      const children = yield* Effect.forEach(object.children, (child) =>
        visit(child, matrix)
      );
      for (const child of children) {
        bounds.union(child.bounds);
      }
      return {
        bounds,
        labels: [
          ...ownLabels,
          ...Arr.flatMap(children, (child) => child.labels),
        ],
      };
    });

    const measured = yield* visit(
      root,
      root.parent?.matrixWorld ?? new Matrix4()
    );
    return measured.bounds.isEmpty() ? Option.none() : Option.some(measured);
  }
);

function transformMeasurement(measured: CameraMeasurement, matrix: Matrix4) {
  measured.bounds.applyMatrix4(matrix);
  for (const label of measured.labels) {
    label.anchors.applyMatrix4(matrix);
  }
  return measured;
}

function motionEnvelope(
  bounds: Box3,
  { rotation, scale = 1, translation }: CameraMotionBounds
) {
  const envelope = bounds.clone();
  if (envelope.isEmpty()) {
    return envelope;
  }
  if (rotation === "all") {
    const radius = Math.hypot(
      Math.max(Math.abs(envelope.min.x), Math.abs(envelope.max.x)),
      Math.max(Math.abs(envelope.min.y), Math.abs(envelope.max.y)),
      Math.max(Math.abs(envelope.min.z), Math.abs(envelope.max.z))
    );
    envelope.min.setScalar(-radius);
    envelope.max.setScalar(radius);
  } else if (rotation) {
    const first = rotation === "x" ? "y" : "x";
    const second = rotation === "z" ? "y" : "z";
    const radius = Math.hypot(
      Math.max(Math.abs(envelope.min[first]), Math.abs(envelope.max[first])),
      Math.max(Math.abs(envelope.min[second]), Math.abs(envelope.max[second]))
    );
    envelope.min[first] = -radius;
    envelope.max[first] = radius;
    envelope.min[second] = -radius;
    envelope.max[second] = radius;
  }
  envelope.min.multiplyScalar(scale);
  envelope.max.multiplyScalar(scale);
  if (translation) {
    envelope.min.add(
      new Vector3(translation.x.min, translation.y.min, translation.z.min)
    );
    envelope.max.add(
      new Vector3(translation.x.max, translation.y.max, translation.z.max)
    );
  }
  return envelope;
}

/** Resolves a camera-facing HTML rectangle in the geometry's world space. */
function labelBounds(
  label: CameraLabelBounds,
  matrix: Matrix4,
  right: Vector3,
  up: Vector3
) {
  const bounds = new Box3();
  const origin = new Vector3().setFromMatrixPosition(matrix);
  const cosine = Math.cos(label.rotation);
  const sine = Math.sin(label.rotation);
  for (const x of [label.anchorX, label.anchorX + 1]) {
    for (const y of [label.anchorY, label.anchorY + 1]) {
      const horizontal = x * label.width + label.gap.x;
      const vertical = y * label.height + label.gap.y;
      bounds.expandByPoint(
        origin
          .clone()
          .addScaledVector(right, horizontal * cosine - vertical * sine)
          .addScaledVector(up, -(horizontal * sine + vertical * cosine))
      );
    }
  }
  return bounds;
}

function pixelLabelBounds(
  label: CameraLabelBounds,
  pixels: NonNullable<CameraLabelBounds["pixels"]>,
  matrix: Matrix4
): CameraPixelLabel {
  const position = new Vector3().setFromMatrixPosition(matrix);
  const rectangle = new Box2();
  const cosine = Math.cos(label.rotation);
  const sine = Math.sin(label.rotation);
  for (const x of [label.anchorX, label.anchorX + 1]) {
    for (const y of [label.anchorY, label.anchorY + 1]) {
      const horizontal = x * pixels.width;
      const vertical = y * pixels.height;
      rectangle.expandByPoint(
        new Vector2(
          horizontal * cosine - vertical * sine,
          -(horizontal * sine + vertical * cosine)
        )
      );
    }
  }
  return {
    anchors: new Box3(position.clone(), position.clone()),
    gap: {
      x: label.gap.x * cosine - label.gap.y * sine,
      y: -(label.gap.x * sine + label.gap.y * cosine),
    },
    rectangle,
  };
}

/** Samples the renderer-owned buffers, including the current instance matrices. */
const measureGeometryBounds = Effect.fn("camera.measureGeometryBounds")(
  (object: Object3D, matrix: Matrix4) =>
    Effect.sync(() => {
      if (object instanceof InstancedMesh) {
        object.boundingBox ??= new Box3();
        object.computeBoundingBox();
        return object.boundingBox.clone().applyMatrix4(matrix);
      }
      if (
        !(
          object instanceof Mesh ||
          object instanceof Line ||
          object instanceof Points
        )
      ) {
        return new Box3();
      }
      object.geometry.boundingBox ??= new Box3();
      object.geometry.computeBoundingBox();
      return object.geometry.boundingBox.clone().applyMatrix4(matrix);
    })
);

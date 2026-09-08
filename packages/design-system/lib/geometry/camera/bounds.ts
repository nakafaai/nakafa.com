import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import { Effect, Option } from "effect";
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

export interface CameraLabelBounds {
  readonly anchorX: number;
  readonly anchorY: number;
  readonly gap: { readonly x: number; readonly y: number };
  readonly height: number;
  readonly pixels?: { readonly width: number; readonly height: number };
  readonly rotation: number;
  readonly width: number;
}

/** A fixed pixel rectangle follows an anchor's complete world-space envelope. */
export interface CameraPixelLabel {
  readonly anchors: Box3;
  readonly gap: { readonly x: number; readonly y: number };
  readonly rectangle: Box2;
}

interface CameraMeasurement {
  readonly bounds: Box3;
  readonly labels: CameraPixelLabel[];
}

export interface CameraMotionBounds {
  readonly rotation?: keyof CoordinateFrame | "all";
  readonly scale?: number;
  readonly translation?: CoordinateFrame;
}

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
    labels: ReadonlyMap<Object3D, CameraLabelBounds>;
    position: Vector3;
    root: Object3D;
    subjects: ReadonlyMap<Object3D, CameraSubjectBounds>;
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
      const result: CameraMeasurement = { bounds: new Box3(), labels: [] };
      const { bounds } = result;
      const subject = subjects.get(object);
      if (!object.visible || subject === false) {
        return result;
      }

      const matrix = parent.clone().multiply(object.matrix);
      if (subject instanceof Box3) {
        bounds.copy(subject).applyMatrix4(matrix);
        return result;
      }
      if (subject) {
        for (const child of object.children) {
          const measured = yield* visit(child, new Matrix4());
          bounds.union(motionEnvelope(measured.bounds, subject));
          result.labels.push(
            ...measured.labels.map((label) => ({
              ...label,
              anchors: motionEnvelope(label.anchors, subject),
            }))
          );
        }
        return transformMeasurement(result, parent);
      }

      bounds.union(yield* measureGeometryBounds(object, matrix));

      const label = labels.get(object);
      if (label) {
        bounds.union(labelBounds(label, matrix, right, up));
        if (label.pixels) {
          result.labels.push(pixelLabelBounds(label, label.pixels, matrix));
        }
      }

      for (const child of object.children) {
        const measured = yield* visit(child, matrix);
        bounds.union(measured.bounds);
        result.labels.push(...measured.labels);
      }
      return result;
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

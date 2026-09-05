import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import { Effect, Option } from "effect";
import {
  Box3,
  InstancedMesh,
  Line,
  Matrix4,
  Mesh,
  type Object3D,
  Points,
  Vector3,
} from "three";

export interface CameraLabelBounds {
  readonly anchorX: number;
  readonly anchorY: number;
  readonly height: number;
  readonly rotation: number;
  readonly width: number;
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
  ({
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
  }) =>
    Effect.sync(() => {
      const basis = new Matrix4().lookAt(
        position,
        target,
        new Vector3(0, 1, 0)
      );
      const right = new Vector3().setFromMatrixColumn(basis, 0);
      const up = new Vector3().setFromMatrixColumn(basis, 1);
      root.updateWorldMatrix(true, true);

      function visit(object: Object3D, parent: Matrix4): Box3 {
        const bounds = new Box3();
        const subject = subjects.get(object);
        if (!object.visible || subject === false) {
          return bounds;
        }

        const matrix = parent.clone().multiply(object.matrix);
        if (subject instanceof Box3) {
          return subject.clone().applyMatrix4(matrix);
        }
        if (subject) {
          for (const child of object.children) {
            bounds.union(motionEnvelope(visit(child, new Matrix4()), subject));
          }
          return bounds.applyMatrix4(parent);
        }

        if (object instanceof InstancedMesh) {
          object.boundingBox ??= new Box3();
          object.computeBoundingBox();
          bounds.union(object.boundingBox.clone().applyMatrix4(matrix));
        } else if (
          object instanceof Mesh ||
          object instanceof Line ||
          object instanceof Points
        ) {
          object.geometry.boundingBox ??= new Box3();
          object.geometry.computeBoundingBox();
          bounds.union(
            object.geometry.boundingBox.clone().applyMatrix4(matrix)
          );
        }

        const label = labels.get(object);
        if (label) {
          const origin = new Vector3().setFromMatrixPosition(matrix);
          const cosine = Math.cos(label.rotation);
          const sine = Math.sin(label.rotation);
          for (const x of [label.anchorX, label.anchorX + 1]) {
            for (const y of [label.anchorY, label.anchorY + 1]) {
              const horizontal = x * label.width;
              const vertical = y * label.height;
              bounds.expandByPoint(
                origin
                  .clone()
                  .addScaledVector(right, horizontal * cosine - vertical * sine)
                  .addScaledVector(up, -(horizontal * sine + vertical * cosine))
              );
            }
          }
        }

        for (const child of object.children) {
          bounds.union(visit(child, matrix));
        }
        return bounds;
      }

      const bounds = visit(root, root.parent?.matrixWorld ?? new Matrix4());
      return bounds.isEmpty() ? Option.none() : Option.some(bounds);
    })
);

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

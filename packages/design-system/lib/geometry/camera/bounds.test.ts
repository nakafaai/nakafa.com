// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  type CameraLabelBounds,
  type CameraSubjectBounds,
  measureCameraBounds,
} from "@repo/design-system/lib/geometry/camera/bounds";
import { Effect, Option } from "effect";
import {
  Box3,
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  Vector3,
} from "three";

const sample = (
  root: Object3D,
  subjects = new Map<Object3D, CameraSubjectBounds>(),
  labels = new Map<Object3D, CameraLabelBounds>()
) =>
  measureCameraBounds({
    labels,
    position: new Vector3(0, 0, 5),
    root,
    subjects,
    target: new Vector3(),
  });

describe("camera subjects", () => {
  it.effect("reports an empty scene without inventing a camera target", () =>
    Effect.gen(function* () {
      expect(Option.isNone(yield* sample(new Group()))).toBe(true);
    })
  );

  it.effect(
    "excludes decoration and invisible geometry while applying parent transforms",
    () =>
      Effect.gen(function* () {
        const root = new Group();
        root.position.set(5, 2, 0);
        const subject = new Mesh(new BoxGeometry(2, 4, 6));
        const sky = new Mesh(new BoxGeometry(900, 900, 900));
        const hidden = new Mesh(new BoxGeometry(100, 100, 100));
        hidden.visible = false;
        root.add(subject, sky, hidden);
        const bounds = Option.getOrThrow(
          yield* sample(root, new Map([[sky, false]]))
        );
        expect(bounds.min.toArray()).toEqual([4, 0, -3]);
        expect(bounds.max.toArray()).toEqual([6, 4, 3]);
      })
  );

  it.effect("measures instanced geometry at every declared placement", () =>
    Effect.gen(function* () {
      const root = new InstancedMesh(
        new BoxGeometry(2, 2, 2),
        new MeshBasicMaterial(),
        2
      );
      root.setMatrixAt(0, new Matrix4().makeTranslation(-3, 0, 0));
      root.setMatrixAt(1, new Matrix4().makeTranslation(4, 0, 0));
      const bounds = Option.getOrThrow(yield* sample(root));
      expect(bounds.min.x).toBe(-4);
      expect(bounds.max.x).toBe(5);
      root.setMatrixAt(1, new Matrix4().makeTranslation(6, 0, 0));
      expect(Option.getOrThrow(yield* sample(root)).max.x).toBe(7);
    })
  );

  it.effect(
    "includes a rendered, anchored HTML rectangle and its rotation",
    () =>
      Effect.gen(function* () {
        const label = new Group();
        label.position.set(2, 3, 0);
        const bounds = Option.getOrThrow(
          yield* sample(
            label,
            new Map(),
            new Map([
              [
                label,
                {
                  anchorX: 0,
                  anchorY: -0.5,
                  height: 1,
                  rotation: Math.PI / 2,
                  width: 4,
                },
              ],
            ])
          )
        );
        expect(bounds.min.x).toBeCloseTo(1.5);
        expect(bounds.max.x).toBeCloseTo(2.5);
        expect(bounds.min.y).toBeCloseTo(-1);
        expect(bounds.max.y).toBeCloseTo(3);
      })
  );

  it.effect(
    "uses a declared full path instead of the animated object's current pose",
    () =>
      Effect.gen(function* () {
        const root = new Group();
        const moving = new Group();
        moving.add(new Mesh(new BoxGeometry(2, 2, 2)));
        root.add(moving);
        const subjects = new Map<Object3D, CameraSubjectBounds>([
          [
            moving,
            {
              translation: {
                x: { min: -5, max: 8 },
                y: { min: 0, max: 4 },
                z: { min: 0, max: 0 },
              },
            },
          ],
        ]);
        const before = Option.getOrThrow(yield* sample(root, subjects));
        moving.position.set(8, 4, 0);
        const after = Option.getOrThrow(yield* sample(root, subjects));
        expect(after.equals(before)).toBe(true);
        expect(before.min.toArray()).toEqual([-6, -1, -1]);
        expect(before.max.toArray()).toEqual([9, 5, 1]);
      })
  );

  it.effect(
    "keeps rotating and pulsing subjects inside a stable envelope",
    () =>
      Effect.gen(function* () {
        for (const rotation of ["x", "y", "z"] as const) {
          const root = new Group();
          root.add(new Mesh(new BoxGeometry(2, 4, 6)));
          const subjects = new Map<Object3D, CameraSubjectBounds>([
            [root, { rotation, scale: 1.2 }],
          ]);
          const before = Option.getOrThrow(yield* sample(root, subjects));
          root.rotation[rotation] = 1.7;
          root.scale.setScalar(0.9);
          expect(
            Option.getOrThrow(yield* sample(root, subjects)).equals(before)
          ).toBe(true);
          expect(
            before.containsPoint(new Vector3(1, 2, 3).multiplyScalar(1.2))
          ).toBe(true);
        }
      })
  );

  it.effect("fits a tumbling model independently of its current pose", () =>
    Effect.gen(function* () {
      const root = new Group();
      root.add(new Mesh(new BoxGeometry(2, 4, 6)));
      const subjects = new Map<Object3D, CameraSubjectBounds>([
        [root, { rotation: "all" }],
      ]);
      const before = Option.getOrThrow(yield* sample(root, subjects));
      root.rotation.set(0.7, 1.2, 2.1);
      const after = Option.getOrThrow(yield* sample(root, subjects));
      expect(after.equals(before)).toBe(true);
      for (const minimum of before.min.toArray()) {
        expect(minimum).toBeCloseTo(-Math.sqrt(14));
      }
      for (const maximum of before.max.toArray()) {
        expect(maximum).toBeCloseTo(Math.sqrt(14));
      }
    })
  );

  it.effect(
    "fits orbiting subjects without sweeping empty space between them",
    () =>
      Effect.gen(function* () {
        const root = new Group();
        for (const [x, z] of [
          [10, 0],
          [0, 10],
          [-10, 0],
          [0, -10],
        ] as const) {
          const subject = new Mesh(new BoxGeometry(2, 2, 2));
          subject.position.set(x, 0, z);
          root.add(subject);
        }
        root.add(new Group());
        const bounds = Option.getOrThrow(
          yield* sample(root, new Map([[root, { rotation: "y" }]]))
        );
        expect(bounds.max.x).toBeCloseTo(Math.hypot(11, 1));
        expect(bounds.max.z).toBeCloseTo(Math.hypot(11, 1));
        expect(bounds.min.x).toBeCloseTo(-Math.hypot(11, 1));
        expect(bounds.min.z).toBeCloseTo(-Math.hypot(11, 1));
      })
  );

  it.effect(
    "uses explicit bounds for a semantic frame and permits an empty motion group",
    () =>
      Effect.gen(function* () {
        const root = new Group();
        root.add(new Mesh(new BoxGeometry(100, 100, 100)));
        const declared = new Box3(new Vector3(1, 2, 3), new Vector3(4, 5, 6));
        expect(
          Option.getOrThrow(
            yield* sample(root, new Map([[root, declared]]))
          ).equals(declared)
        ).toBe(true);
        const empty = new Group();
        expect(
          Option.isNone(
            yield* sample(empty, new Map([[empty, { rotation: "y" }]]))
          )
        ).toBe(true);
      })
  );
});

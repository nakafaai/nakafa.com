import { describe, expect, it } from "@effect/vitest";
import {
  clipOpenLineEnds,
  LineEndpointError,
  resolveLineEndpoints,
} from "@repo/design-system/lib/geometry/endpoint";
import { Effect } from "effect";
import {
  Euler,
  Matrix4,
  OrthographicCamera,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from "three";

const points = [new Vector3(0, 0, 0), new Vector3(2, 0, 0)];

describe("mathematical branch endpoints", () => {
  it.each([1, 2 / 3])(
    "keeps a 4px round cap outside an open ring at zoom %s",
    (zoom) => {
      const height = 294;
      const pixelsPerUnit =
        (height / (24 * Math.tan((25 * Math.PI) / 180))) * zoom;
      const camera = new OrthographicCamera(-147, 147, 147, -147, 0.01, 1000);
      camera.zoom = pixelsPerUnit;
      camera.position.z = 12;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      const clipped = clipOpenLineEnds(
        points,
        { start: "open", end: "open" },
        camera,
        0.1,
        new Matrix4(),
        {
          width: height,
          height,
          lineWidth: 4,
        }
      );
      for (const index of [0, 1]) {
        const center = points[index].clone().project(camera);
        const tip = clipped[index].clone().project(camera);
        const centerDistance = (center.distanceTo(tip) * height) / 2;
        expect(centerDistance - 2).toBeGreaterThanOrEqual(
          0.1 * pixelsPerUnit - 1e-8
        );
        expect(centerDistance - 2).toBeCloseTo(0.1 * pixelsPerUnit, 5);
      }
      expect(
        clipOpenLineEnds(
          points,
          { start: "open" },
          camera,
          0.1,
          new Matrix4(),
          {
            width: height,
            height,
            lineWidth: 0,
          }
        )[0].x
      ).toBeCloseTo(0.1, 12);
    }
  );

  it.each([
    [12, 0.1, 0.1],
    [7, 3, 10],
  ])("keeps a round cap outside a scaled ring from camera %j", (x, y, z) => {
    const width = 672;
    const height = 470;
    const camera = new PerspectiveCamera(50, width / height, 0.01, 1000);
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const authored = [
      new Vector3(),
      new Vector3(0.001, 0.001, 0),
      new Vector3(2, 1, 0),
    ];
    const world = new Matrix4().compose(
      new Vector3(),
      new Quaternion(),
      new Vector3(2, 0.75, 1.5)
    );
    const clipped = clipOpenLineEnds(
      authored,
      { start: "open" },
      camera,
      0.1,
      world,
      { width, height, lineWidth: 4 }
    );
    const tip = clipped[0].clone().applyMatrix4(world).project(camera);
    const center = authored[0].clone().project(camera);
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const rx = right.multiplyScalar(0.2).project(camera).x - center.x;
    const ry = up.multiplyScalar(0.075).project(camera).y - center.y;
    let clearance = Number.POSITIVE_INFINITY;
    for (let sample = 0; sample < 720; sample += 1) {
      const angle = (sample * Math.PI) / 360;
      clearance = Math.min(
        clearance,
        Math.hypot(
          ((tip.x - center.x - rx * Math.cos(angle)) * width) / 2,
          ((tip.y - center.y - ry * Math.sin(angle)) * height) / 2
        )
      );
    }
    expect(clearance).toBeGreaterThanOrEqual(2 - 1e-5);
    expect(clearance).toBeLessThan(2.01);
    expect(clipped).toHaveLength(2);
    expect(
      clipOpenLineEnds(
        authored.slice(0, 2),
        { start: "open" },
        camera,
        0.1,
        world,
        { width, height, lineWidth: 4 }
      )
    ).toEqual([]);
    expect(authored.map((point) => point.toArray())).toEqual([
      [0, 0, 0],
      [0.001, 0.001, 0],
      [2, 1, 0],
    ]);
  });

  it.effect("preserves exact authored endpoint identity and membership", () =>
    Effect.gen(function* () {
      const endpoints = yield* resolveLineEndpoints(points, {
        start: "closed",
        end: "open",
      });
      expect(endpoints).toEqual([
        { index: 0, point: points[0], state: "closed" },
        { index: 1, point: points[1], state: "open" },
      ]);
      expect(endpoints[0].point).toBe(points[0]);
      expect(endpoints[1].point).toBe(points[1]);
      expect(yield* resolveLineEndpoints(points)).toEqual([]);
      expect(yield* resolveLineEndpoints([])).toEqual([]);
      expect(yield* resolveLineEndpoints([], {})).toEqual([]);
    })
  );

  it.effect("represents an isolated included point exactly once", () =>
    Effect.gen(function* () {
      const singleton = points.slice(0, 1);
      expect(
        yield* resolveLineEndpoints(singleton, {
          start: "closed",
          end: "closed",
        })
      ).toEqual([{ index: 0, point: points[0], state: "closed" }]);
      expect(yield* resolveLineEndpoints(singleton, { end: "closed" })).toEqual(
        [{ index: 0, point: points[0], state: "closed" }]
      );
    })
  );

  it.effect(
    "rejects missing, contradictory, or invalid endpoint declarations",
    () =>
      Effect.gen(function* () {
        expect(
          yield* Effect.flip(resolveLineEndpoints([], { start: "closed" }))
        ).toBeInstanceOf(LineEndpointError);
        expect(
          yield* Effect.flip(resolveLineEndpoints([], { end: "open" }))
        ).toBeInstanceOf(LineEndpointError);
        expect(
          yield* Effect.flip(
            resolveLineEndpoints(points.slice(0, 1), {
              start: "open",
              end: "closed",
            })
          )
        ).toBeInstanceOf(LineEndpointError);
        expect(
          yield* Effect.flip(resolveLineEndpoints(points, { start: "solid" }))
        ).toBeInstanceOf(LineEndpointError);
      })
  );

  it("leaves closed branches and authored coordinates unchanged", () => {
    const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    camera.position.z = 10;
    camera.updateMatrixWorld();
    expect(clipOpenLineEnds(points, { start: "closed" }, camera, 0.1)).toBe(
      points
    );
    const clipped = clipOpenLineEnds(
      points,
      { start: "open", end: "open" },
      camera,
      0.1
    );
    expect(clipped[0].x).toBeCloseTo(0.1, 12);
    expect(clipped[1].x).toBeCloseTo(1.9, 12);
    const halfOpen = clipOpenLineEnds(
      points,
      { start: "closed", end: "open" },
      camera,
      0.1
    );
    expect(halfOpen[0].x).toBe(0);
    expect(halfOpen[1].x).toBeCloseTo(1.9, 12);
    expect(points[0].x).toBe(0);
    expect(points[1].x).toBe(2);
  });

  it("clips dense samples inside the ring and hides a fully covered branch", () => {
    const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    camera.position.z = 10;
    camera.updateMatrixWorld();
    const dense = [
      points[0],
      new Vector3(0.025, 0, 0),
      new Vector3(0.05, 0, 0),
      points[1],
    ];
    const clipped = clipOpenLineEnds(dense, { start: "open" }, camera, 0.1);
    expect(clipped).toHaveLength(2);
    expect(clipped[0].x).toBeCloseTo(0.1, 12);
    expect(
      clipOpenLineEnds(dense.slice(0, 3), { start: "open" }, camera, 0.1)
    ).toEqual([]);
    expect(
      clipOpenLineEnds([], { start: "open", end: "open" }, camera, 0.1)
    ).toEqual([]);
  });

  it.each([
    [0, 0, 10],
    [7, 3, 10],
    [-5, 4, 8],
  ])("keeps the ring hollow in perspective from camera %j", (x, y, z) => {
    const camera = new PerspectiveCamera(45, 1.4, 0.1, 100);
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const clipped = clipOpenLineEnds(points, { start: "open" }, camera, 0.1);
    const center = points[0].clone().project(camera);
    const boundary = clipped[0].clone().project(camera);
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const rx =
      points[0].clone().addScaledVector(right, 0.1).project(camera).x -
      center.x;
    const ry =
      points[0].clone().addScaledVector(up, 0.1).project(camera).y - center.y;
    expect(
      ((boundary.x - center.x) / rx) ** 2 + ((boundary.y - center.y) / ry) ** 2
    ).toBeCloseTo(1, 10);
    expect(clipped[0].y).toBe(0);
    expect(clipped[0].z).toBe(0);
  });

  it.each([
    new OrthographicCamera(-4, 4, 3, -3, 0.1, 100),
    new PerspectiveCamera(45, 1.4, 0.1, 100),
  ])("clips in world space under nested transformed parents", (camera) => {
    camera.position.set(6, 4, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const parent = new Matrix4().compose(
      new Vector3(1, -2, 1),
      new Quaternion().setFromEuler(new Euler(0.3, 0.5, -0.7)),
      new Vector3(2, 0.75, 1.5)
    );
    const child = new Matrix4().compose(
      new Vector3(0.2, 1, -0.5),
      new Quaternion().setFromEuler(new Euler(-0.2, 0.3, 0.4)),
      new Vector3(0.8, 1.2, 1)
    );
    const world = parent.multiply(child);
    const scale = new Vector3().setFromMatrixScale(world);
    const clipped = clipOpenLineEnds(
      points,
      { start: "open", end: "open" },
      camera,
      0.1,
      world
    );
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    for (const index of [0, 1]) {
      const centerWorld = points[index].clone().applyMatrix4(world);
      const center = centerWorld.clone().project(camera);
      const boundary = clipped[index]
        .clone()
        .applyMatrix4(world)
        .project(camera);
      const rx =
        centerWorld
          .clone()
          .addScaledVector(right, 0.1 * scale.x)
          .project(camera).x - center.x;
      const ry =
        centerWorld
          .clone()
          .addScaledVector(up, 0.1 * scale.y)
          .project(camera).y - center.y;
      expect(
        ((boundary.x - center.x) / rx) ** 2 +
          ((boundary.y - center.y) / ry) ** 2
      ).toBeCloseTo(1, 10);
      expect(clipped[index].y).toBeCloseTo(0, 12);
      expect(clipped[index].z).toBeCloseTo(0, 12);
    }
    expect(points[0].toArray()).toEqual([0, 0, 0]);
    expect(points[1].toArray()).toEqual([2, 0, 0]);
  });
});

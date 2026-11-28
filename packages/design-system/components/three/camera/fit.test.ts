import { describe, expect, it } from "@effect/vitest";
import {
  cameraFitKey,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  FRAME_EDGE_SHARE,
  resolveContentFit,
  resolvePanOffset,
} from "@repo/design-system/components/three/camera/fit";
import type { CameraSilhouette } from "@repo/design-system/components/three/camera/silhouette";
import { silhouetteBounds } from "@repo/design-system/components/three/camera/silhouette";
import { Array as Arr, Match } from "effect";
import {
  Box2,
  Box3,
  Matrix4,
  OrthographicCamera,
  PerspectiveCamera,
  Vector2,
  Vector3,
} from "three";

const TIGHT = 1 - 2 * FRAME_EDGE_SHARE;
const FRAMES = [
  { height: 300, width: 390 },
  { height: 720, width: 1280 },
  { height: 800, width: 800 },
  { height: 640, width: 320 },
];
const FIELDS = [30, 50, 75];
const position = new Vector3(...DEFAULT_CAMERA_POSITION);
const target = new Vector3(...DEFAULT_CAMERA_TARGET);
/** The hull of a box's eight corners, as the measurement gives a part. */
function hullOf(
  min: Vector3,
  max: Vector3,
  matrix = new Matrix4()
): CameraSilhouette {
  return {
    kind: "hull",
    points: Arr.flatMap([min.x, max.x], (x) =>
      Arr.flatMap([min.y, max.y], (y) =>
        Arr.map([min.z, max.z], (z) => new Vector3(x, y, z).applyMatrix4(matrix))
      )
    ),
  };
}

const box = hullOf(new Vector3(-3, -0.5, -1), new Vector3(2, 1.5, 1));
const sphere: CameraSilhouette = {
  center: new Vector3(1, 2, -1),
  kind: "sphere",
  radius: 1.5,
};
const ring: CameraSilhouette = {
  center: new Vector3(0, 0.5, 0),
  kind: "ring",
  normal: new Vector3(0, 1, 0),
  radius: 2,
};

/** Points on a silhouette's surface, dense enough to find its projected edge. */
function surface(silhouette: CameraSilhouette) {
  return Match.value(silhouette).pipe(
    Match.discriminatorsExhaustive("kind")({
      hull: ({ points }) => points,
      ring: ({ center, normal, radius }) => {
        const first = new Vector3(1, 0, 0).cross(normal).normalize();
        const second = first.clone().cross(normal);
        return Arr.makeBy(720, (step) =>
          center
            .clone()
            .addScaledVector(first, radius * Math.cos((step * Math.PI) / 360))
            .addScaledVector(second, radius * Math.sin((step * Math.PI) / 360))
        );
      },
      sphere: ({ center, radius }) =>
        Arr.flatMap(
          Arr.makeBy(181, (row) => (row * Math.PI) / 180),
          (polar) =>
            Arr.makeBy(360, (step) =>
              new Vector3()
                .setFromSphericalCoords(radius, polar, (step * Math.PI) / 180)
                .add(center)
            )
        ),
    })
  );
}

/** Projects points through the fitted camera to shares of the frame. */
function frameOf(
  points: readonly Vector3[],
  fit: ReturnType<typeof resolveContentFit>,
  view: { fov: number; height: number; width: number },
  projection: "orthographic" | "perspective"
) {
  const aspect = view.width / view.height;
  const camera =
    projection === "perspective"
      ? new PerspectiveCamera(view.fov, aspect, fit.near, fit.far)
      : new OrthographicCamera(
          (-fit.viewHeight * aspect) / 2,
          (fit.viewHeight * aspect) / 2,
          fit.viewHeight / 2,
          -fit.viewHeight / 2,
          fit.near,
          fit.far
        );
  camera.position.copy(fit.position);
  camera.lookAt(fit.target);
  camera.updateMatrixWorld();
  const projected = new Box2().setFromPoints(
    Arr.map(points, (point) => {
      const screen = point.clone().project(camera);
      return new Vector2(screen.x / 2 + 0.5, screen.y / 2 + 0.5);
    })
  );
  const size = projected.getSize(new Vector2());
  return { ...projected, binding: Math.max(size.x, size.y), size };
}

function fitOf(
  silhouettes: readonly CameraSilhouette[],
  view: { fov: number; height: number; width: number },
  projection: "orthographic" | "perspective" = "perspective"
) {
  return resolveContentFit({
    ...view,
    labels: [],
    minimumViewHeight: 0,
    position,
    projection,
    silhouettes,
    target,
  });
}

describe("resolveContentFit", () => {
  it("spans the tight share of the binding side for a box at every frame and field of view", () => {
    for (const frame of FRAMES) {
      for (const fov of FIELDS) {
        for (const projection of ["perspective", "orthographic"] as const) {
          const view = { ...frame, fov };
          const fit = fitOf([box], view, projection);
          const framed = frameOf(surface(box), fit, view, projection);
          expect(framed.binding).toBeCloseTo(TIGHT, 6);
          expect(framed.binding).toBeGreaterThanOrEqual(0.88);
          expect(framed.min.x).toBeGreaterThan(FRAME_EDGE_SHARE - 1e-6);
          expect(framed.min.y).toBeGreaterThan(FRAME_EDGE_SHARE - 1e-6);
          expect(framed.max.x).toBeLessThan(1 - FRAME_EDGE_SHARE + 1e-6);
          expect(framed.max.y).toBeLessThan(1 - FRAME_EDGE_SHARE + 1e-6);
          // Both sides keep the same free share, at any depth of the box.
          expect(framed.min.x + framed.max.x).toBeCloseTo(1, 6);
          expect(framed.min.y + framed.max.y).toBeCloseTo(1, 6);
        }
      }
    }
  });

  it("fits a ball and a ring by their true outline, not by box corners", () => {
    for (const frame of FRAMES) {
      for (const fov of FIELDS) {
        for (const projection of ["perspective", "orthographic"] as const) {
          for (const round of [sphere, ring]) {
            const view = { ...frame, fov };
            const fit = fitOf([round], view, projection);
            const framed = frameOf(surface(round), fit, view, projection);
            expect(framed.binding).toBeLessThan(TIGHT + 1e-6);
            expect(framed.binding).toBeGreaterThan(TIGHT - 2e-3);
            expect(framed.min.x + framed.max.x).toBeCloseTo(1, 2);
            expect(framed.min.y + framed.max.y).toBeCloseTo(1, 2);

            const boxed = fitOf(
              [
                hullOf(
                  silhouetteBounds(round).min,
                  silhouetteBounds(round).max
                ),
              ],
              view,
              projection
            );
            const amount =
              projection === "perspective" ? "distance" : "viewHeight";
            expect(fit[amount]).toBeLessThan(boxed[amount] * 0.95);
          }
        }
      }
    }
  });

  it("holds every silhouette of a mixed scene inside the frame", () => {
    const view = { fov: 50, height: 300, width: 390 };
    const scene = [box, sphere, ring];
    const fit = fitOf(scene, view);
    const framed = frameOf(
      Arr.flatMap(scene, surface),
      fit,
      view,
      "perspective"
    );

    expect(framed.binding).toBeLessThan(TIGHT + 1e-6);
    expect(framed.binding).toBeGreaterThan(TIGHT - 2e-3);
    expect(fit.bounds.containsBox(silhouetteBounds(sphere))).toBe(true);
    expect(fit.far).toBeGreaterThan(fit.distance + fit.radius);
  });

  it("keeps the camera off a subject without size and honours a minimum view height", () => {
    const point = hullOf(new Vector3(1, 1, 1), new Vector3(1, 1, 1));
    const view = { fov: 50, height: 600, width: 800 };

    const near = fitOf([point], view);
    expect(near.distance).toBeCloseTo(0.0002, 6);
    expect(near.target.distanceTo(new Vector3(1, 1, 1))).toBeCloseTo(0);

    const flat = resolveContentFit({
      ...view,
      labels: [],
      minimumViewHeight: 10,
      position,
      projection: "orthographic",
      silhouettes: [point],
      target,
    });
    expect(flat.viewHeight).toBe(10);
    expect(flat.distance).toBeCloseTo(0.02);
  });

  it("reserves exactly a pixel label's rectangle and nothing when there is none", () => {
    const view = { fov: 45, height: 600, width: 800 };
    const front = new Vector3(0, 0, 5);
    const cube = hullOf(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
    const input = {
      ...view,
      minimumViewHeight: 0,
      position: front,
      projection: "perspective" as const,
      silhouettes: [cube],
      target: new Vector3(),
    };
    const plain = resolveContentFit({ ...input, labels: [] });
    const labels = [
      {
        anchors: new Box3(new Vector3(1, 0, 1), new Vector3(1, 0, 1)),
        gap: { x: 0.25, y: 0 },
        rectangle: new Box2(new Vector2(0, -12), new Vector2(240, 12)),
      },
      {
        anchors: new Box3(new Vector3(0, 1, 1), new Vector3(0.5, 1, 1)),
        gap: { x: 0, y: 0.25 },
        rectangle: new Box2(new Vector2(-40, 0), new Vector2(40, 24)),
      },
      {
        anchors: new Box3(new Vector3(0, -1, 1), new Vector3(0, -1, 1)),
        gap: { x: 0, y: 0 },
        rectangle: new Box2(new Vector2(-30, -20), new Vector2(30, 0)),
      },
    ];
    const labelled = resolveContentFit({ ...input, labels });

    expect(labelled.distance).toBeGreaterThan(plain.distance);
    // The widest label ends exactly at the free edge share, gap included.
    const anchor = frameOf(
      [new Vector3(1.25, 0, 1)],
      labelled,
      view,
      "perspective"
    );
    expect(anchor.max.x * view.width + 240).toBeCloseTo(
      view.width * (1 - FRAME_EDGE_SHARE),
      4
    );
    // The cube keeps the room the labels do not need.
    const framed = frameOf(surface(cube), labelled, view, "perspective");
    expect(framed.min.x).toBeCloseTo(FRAME_EDGE_SHARE, 6);

    const flat = resolveContentFit({
      ...input,
      labels,
      projection: "orthographic",
    });
    const flatAnchor = frameOf(
      [new Vector3(1.25, 0, 1)],
      flat,
      view,
      "orthographic"
    );
    expect(flatAnchor.max.x * view.width + 240).toBeCloseTo(
      view.width * (1 - FRAME_EDGE_SHARE),
      4
    );
  });

  it("fits a turned, sparse scene by its parts, not by the world box round them", () => {
    const view = { fov: 50, height: 300, width: 390 };
    // Two thin bars on a diagonal leave most of their world box empty.
    const turn = new Matrix4().makeRotationY(Math.PI / 4);
    const bar = (offset: number) =>
      hullOf(
        new Vector3(-2, -0.1, offset - 0.1),
        new Vector3(2, 0.1, offset + 0.1),
        turn
      );
    const parts = [bar(-1.5), bar(1.5)];
    const world = new Box3();
    for (const part of parts) {
      world.union(silhouetteBounds(part));
    }

    const fit = fitOf(parts, view);
    const boxed = fitOf([hullOf(world.min, world.max)], view);
    const framed = frameOf(Arr.flatMap(parts, surface), fit, view, "perspective");

    expect(fit.distance).toBeLessThan(boxed.distance * 0.97);
    expect(framed.binding).toBeCloseTo(TIGHT, 6);
  });

  it("releases only the labels that cannot share the frame, largest first", () => {
    const input = {
      fov: 45,
      height: 360,
      minimumViewHeight: 0,
      position: new Vector3(0, 0, 5),
      projection: "perspective" as const,
      silhouettes: [box],
      target: new Vector3(),
      width: 320,
    };
    const wide = {
      anchors: new Box3(new Vector3(), new Vector3()),
      gap: { x: 0, y: 0 },
      rectangle: new Box2(new Vector2(-220, -20), new Vector2(220, 20)),
    };
    const small = {
      anchors: new Box3(new Vector3(2, 0, 0), new Vector3(2, 0, 0)),
      gap: { x: 0, y: 0 },
      rectangle: new Box2(new Vector2(0, -10), new Vector2(60, 10)),
    };

    const kept = resolveContentFit({ ...input, labels: [small, wide] });
    const alone = resolveContentFit({ ...input, labels: [small] });
    const plain = resolveContentFit({ ...input, labels: [] });

    expect(kept.distance).toBe(alone.distance);
    expect(kept.distance).toBeGreaterThan(plain.distance);
    expect(resolveContentFit({ ...input, labels: [wide, small] }).distance).toBe(
      alone.distance
    );
  });

  it("fits the content alone when a label cannot share the frame with it", () => {
    const input = {
      fov: 45,
      height: 360,
      minimumViewHeight: 0,
      position: new Vector3(0, 0, 5),
      projection: "perspective" as const,
      silhouettes: [box],
      target: new Vector3(),
      width: 320,
    };
    const wide = {
      anchors: new Box3(new Vector3(), new Vector3()),
      gap: { x: 0, y: 0 },
      rectangle: new Box2(new Vector2(-220, -20), new Vector2(220, 20)),
    };

    const fallback = resolveContentFit({ ...input, labels: [wide] });
    const plain = resolveContentFit({ ...input, labels: [] });

    expect(fallback.distance).toBe(plain.distance);
    expect(fallback.target.equals(plain.target)).toBe(true);
  });
});

describe("resolvePanOffset", () => {
  it("returns the pan target to the fitted content in the caller's vector", () => {
    const bounds = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
    const offset = new Vector3();

    expect(resolvePanOffset(bounds, new Vector3(3, 0, -2), offset)).toBe(
      offset
    );
    expect(offset.toArray()).toEqual([-2, 0, 1]);
    expect(
      resolvePanOffset(bounds, new Vector3(0.5, 0, 0), offset).length()
    ).toBe(0);
  });
});

describe("cameraFitKey", () => {
  it("changes with any silhouette, label, pose or limit and stays equal otherwise", () => {
    const base = {
      authoredPosition: position,
      authoredTarget: target,
      labels: [
        {
          anchors: new Box3(new Vector3(0, 0, 0), new Vector3(1, 0, 0)),
          gap: { x: 4, y: 8 },
          rectangle: new Box2(new Vector2(-2, -1), new Vector2(2, 1)),
        },
      ],
      maxDistance: undefined,
      minDistance: undefined,
      projectionFar: undefined,
      projectionFov: 50,
      projectionHeight: 0,
      projectionNear: undefined,
      silhouettes: [box, sphere, ring],
      viewportHeight: 600,
      viewportWidth: 800,
    };

    const first = cameraFitKey(base);
    const limited = cameraFitKey({ ...base, maxDistance: 40, minDistance: 2 });
    const grown = cameraFitKey({
      ...base,
      silhouettes: [box, { ...sphere, radius: 2 }, ring],
    });

    expect(first).toBe(cameraFitKey(base));
    expect(limited).not.toBe(first);
    expect(limited).toContain(",2,40");
    expect(grown).not.toBe(first);
    expect(first).toContain("hull,-3,-0.5,-1,-3,-0.5,1,");
    expect(first).toContain(",sphere,1,2,-1,1.5,ring,");
  });
});

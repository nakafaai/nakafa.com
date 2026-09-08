// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { CameraPixelLabel } from "@repo/design-system/lib/geometry/camera/bounds";
import {
  CameraLabelFitError,
  resolveCameraFit,
  resolveCameraPanOffset,
  resolveCameraRefit,
} from "@repo/design-system/lib/geometry/camera/fit";
import { Effect } from "effect";
import {
  Box2,
  Box3,
  OrthographicCamera,
  PerspectiveCamera,
  Vector2,
  Vector3,
} from "three";

const pixelLabel = (
  x: number,
  y: number,
  left: number,
  right: number,
  bottom = -9,
  top = 9
): CameraPixelLabel => ({
  anchors: new Box3(new Vector3(x, y, 0), new Vector3(x, y, 0)),
  gap: { x: 0, y: 0 },
  rectangle: new Box2(new Vector2(left, bottom), new Vector2(right, top)),
});

describe("finite camera framing", () => {
  it.effect.each([
    { width: 284, height: 320, position: new Vector3(0, 0, 4) },
    { width: 840, height: 460, position: new Vector3(0, 0, 4) },
    { width: 320, height: 460, position: new Vector3(8, 5, 11) },
    { width: 840, height: 460, position: new Vector3(0, 10, 0) },
  ])(
    "fits offset geometry and label extents at $width by $height",
    ({ width, height, position }) =>
      Effect.gen(function* () {
        const bounds = new Box3(
          new Vector3(-0.12, -0.3, -0.1),
          new Vector3(3.1, 1.4, 0.1)
        );
        const original = bounds.clone();
        const fit = yield* resolveCameraFit({
          bounds,
          fov: 50,
          height,
          position,
          projection: "perspective",
          target: new Vector3(),
          width,
        });
        const camera = new PerspectiveCamera(
          50,
          width / height,
          fit.near,
          fit.far
        );
        camera.position.copy(fit.position);
        camera.lookAt(fit.target);
        camera.updateMatrixWorld();

        for (const x of [bounds.min.x, bounds.max.x]) {
          for (const y of [bounds.min.y, bounds.max.y]) {
            for (const z of [bounds.min.z, bounds.max.z]) {
              const projected = new Vector3(x, y, z).project(camera);
              expect(Math.abs(projected.x)).toBeLessThanOrEqual(
                1 - 48 / width + 1e-10
              );
              expect(Math.abs(projected.y)).toBeLessThanOrEqual(
                1 - 48 / height + 1e-10
              );
              expect(Math.abs(projected.z)).toBeLessThan(1);
            }
          }
        }
        expect(bounds.equals(original)).toBe(true);
        expect(fit.target.equals(bounds.getCenter(new Vector3()))).toBe(true);
        expect(
          fit.position
            .clone()
            .sub(fit.target)
            .normalize()
            .dot(position.clone().normalize())
        ).toBeCloseTo(1);
      })
  );

  it.effect.each([284, 840])(
    "fits an orthographic frame without stretching at %i pixels",
    (width) =>
      Effect.gen(function* () {
        const height = 400;
        const bounds = new Box3(new Vector3(-6, -1, 0), new Vector3(6, 1, 0));
        const fit = yield* resolveCameraFit({
          bounds,
          fov: 50,
          height,
          position: new Vector3(0, 0, 5),
          projection: "orthographic",
          target: new Vector3(),
          width,
        });
        const camera = new OrthographicCamera(
          -width / 2,
          width / 2,
          height / 2,
          -height / 2,
          fit.near,
          fit.far
        );
        camera.zoom = height / fit.viewHeight;
        camera.position.copy(fit.position);
        camera.lookAt(fit.target);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        expect(
          Math.abs(bounds.max.clone().project(camera).x)
        ).toBeLessThanOrEqual(1 - 48 / width + 1e-10);
        const origin = new Vector3().project(camera);
        const xUnit =
          new Vector3(1, 0, 0).project(camera).sub(origin).x * width;
        const yUnit =
          new Vector3(0, 1, 0).project(camera).sub(origin).y * height;
        expect(xUnit).toBeCloseTo(yUnit);
      })
  );

  it.effect(
    "scales the camera with source units and keeps a point view finite",
    () =>
      Effect.gen(function* () {
        const makeFit = (scale: number) =>
          resolveCameraFit({
            bounds: new Box3(
              new Vector3(-scale, -scale, -scale),
              new Vector3(scale, scale, scale)
            ),
            fov: 45,
            height: 400,
            position: new Vector3(4, 3, 5),
            projection: "perspective",
            target: new Vector3(),
            width: 600,
          });
        const scaled = yield* makeFit(10_000);
        const original = yield* makeFit(1);
        expect(scaled.distance / original.distance).toBeCloseTo(10_000);
        const point = yield* resolveCameraFit({
          bounds: new Box3(new Vector3(3, 4, 5), new Vector3(3, 4, 5)),
          fov: 45,
          height: 30,
          position: new Vector3(0, 0, 4),
          projection: "perspective",
          target: new Vector3(),
          width: 30,
        });
        expect(point.distance).toBeGreaterThan(0);
        expect(point.viewHeight).toBeGreaterThan(0);
      })
  );

  it("allows focus anywhere inside the content and stops panning beyond it", () => {
    const bounds = new Box3(new Vector3(-2, -1, 0), new Vector3(4, 3, 0));
    expect(
      resolveCameraPanOffset(bounds, new Vector3(1, 2, 0)).toArray()
    ).toEqual([0, 0, 0]);
    expect(
      resolveCameraPanOffset(bounds, new Vector3(20, -8, 5)).toArray()
    ).toEqual([-16, 7, -5]);
  });
});

describe("minimum screen-space label framing", () => {
  it.effect.each(["perspective", "orthographic"] as const)(
    "fits an exact-width label only when its anchor leaves room for the geometry in %s",
    (projection) =>
      Effect.gen(function* () {
        const options = {
          bounds: new Box3(new Vector3(0, -1, 0), new Vector3(4, 1, 0)),
          fov: 50,
          height: 224,
          width: 224,
          position: new Vector3(0, 0, 10),
          target: new Vector3(),
          projection,
          labels: [pixelLabel(0, 0, 0, 176)],
        };
        const fitted = yield* resolveCameraFit(options);
        expect(Number.isFinite(fitted.distance)).toBe(true);
        expect(Number.isFinite(fitted.viewHeight)).toBe(true);
        const error = yield* Effect.flip(
          resolveCameraFit({
            ...options,
            bounds: new Box3(new Vector3(-1, -1, 0), new Vector3(3, 1, 0)),
          })
        );
        expect(error).toBeInstanceOf(CameraLabelFitError);
        expect(error.axis).toBe("horizontal");
      })
  );

  it.effect(
    "moves the target left when the minimum label extends left of its anchor",
    () =>
      Effect.gen(function* () {
        const fitted = yield* resolveCameraFit({
          bounds: new Box3(new Vector3(-3, -2, 0), new Vector3(3, 2, 0)),
          fov: 50,
          height: 224,
          width: 224,
          position: new Vector3(0, 0, 10),
          target: new Vector3(),
          projection: "perspective",
          labels: [pixelLabel(-2, 1, -128, 0)],
        });
        expect(fitted.target.x).toBeLessThan(0);
      })
  );

  it.effect.each([
    { projection: "perspective", width: 224 },
    { projection: "orthographic", width: 224 },
    { projection: "perspective", width: 672 },
    { projection: "orthographic", width: 672 },
  ] as const)(
    "fits long one-sided labels with the 24px margin in $projection at $width",
    ({ projection, width }) =>
      Effect.gen(function* () {
        const height = 320;
        const bounds = new Box3(new Vector3(-3, -2, -1), new Vector3(3, 2, 1));
        const position = new Vector3(0, 0, 10);
        const label = pixelLabel(2, 1, 0, 128, -18, 0);
        const labels = [{ ...label, gap: { x: 0.15, y: 0.15 } }];
        const options = {
          bounds,
          fov: 50,
          height,
          position,
          projection,
          target: new Vector3(),
          width,
        };
        const original = yield* resolveCameraFit(options);
        const fitted = yield* resolveCameraFit({ ...options, labels });
        const camera =
          projection === "perspective"
            ? new PerspectiveCamera(50, width / height, fitted.near, fitted.far)
            : new OrthographicCamera(
                -width / 2,
                width / 2,
                height / 2,
                -height / 2,
                fitted.near,
                fitted.far
              );
        if (camera instanceof OrthographicCamera) {
          camera.zoom = height / fitted.viewHeight;
        }
        camera.position.copy(fitted.position);
        camera.lookAt(fitted.target);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        for (const x of [bounds.min.x, bounds.max.x]) {
          for (const y of [bounds.min.y, bounds.max.y]) {
            for (const z of [bounds.min.z, bounds.max.z]) {
              const point = new Vector3(x, y, z).project(camera);
              expect((Math.abs(point.x) * width) / 2).toBeLessThanOrEqual(
                width / 2 - 24 + 1e-9
              );
              expect((Math.abs(point.y) * height) / 2).toBeLessThanOrEqual(
                height / 2 - 24 + 1e-9
              );
            }
          }
        }
        for (const gapScale of [0, 1]) {
          const anchor = label.anchors.min
            .clone()
            .add(new Vector3(0.15 * gapScale, 0.15 * gapScale, 0))
            .project(camera);
          const x = ((anchor.x + 1) * width) / 2;
          const y = ((anchor.y + 1) * height) / 2;
          expect(x + label.rectangle.min.x).toBeGreaterThanOrEqual(24 - 1e-9);
          expect(x + label.rectangle.max.x).toBeLessThanOrEqual(
            width - 24 + 1e-9
          );
          expect(y + label.rectangle.min.y).toBeGreaterThanOrEqual(24 - 1e-9);
          expect(y + label.rectangle.max.y).toBeLessThanOrEqual(
            height - 24 + 1e-9
          );
        }
        expect(fitted.distance).toBeGreaterThanOrEqual(original.distance);
        expect(fitted.viewHeight).toBeGreaterThanOrEqual(original.viewHeight);
        if (width === 224) {
          expect(fitted.target.x).toBeGreaterThan(original.target.x);
        }
        expect(position.toArray()).toEqual([0, 0, 10]);
        expect(label.anchors.min.toArray()).toEqual([2, 1, 0]);
      })
  );

  it.effect.each(["perspective", "orthographic"] as const)(
    "retains the existing target and fit when the floor already fits in %s",
    (projection) =>
      Effect.gen(function* () {
        const options = {
          bounds: new Box3(new Vector3(-3, -2, 0), new Vector3(3, 2, 0)),
          fov: 50,
          height: 224,
          width: 224,
          position: new Vector3(0, 0, 10),
          target: new Vector3(),
          projection,
        };
        const original = yield* resolveCameraFit(options);
        const fitted = yield* resolveCameraFit({
          ...options,
          labels: [pixelLabel(0, 0, -8, 8)],
        });
        expect(fitted.target.equals(original.target)).toBe(true);
        expect(fitted.distance).toBeCloseTo(original.distance);
        expect(fitted.viewHeight).toBeCloseTo(original.viewHeight);
      })
  );

  it.effect.each(["perspective", "orthographic"] as const)(
    "reports an infeasible width and opposing placements in %s without shrinking text",
    (projection) =>
      Effect.gen(function* () {
        const options = {
          bounds: new Box3(new Vector3(-3, -2, 0), new Vector3(3, 2, 0)),
          fov: 50,
          height: 224,
          width: 224,
          position: new Vector3(0, 0, 10),
          target: new Vector3(),
          projection,
        };
        for (const labels of [
          [pixelLabel(0, 0, -90, 90)],
          [pixelLabel(-2, 0, -150, 0), pixelLabel(2, 0, 0, 150)],
        ]) {
          const error = yield* Effect.flip(
            resolveCameraFit({ ...options, labels })
          );
          expect(error).toBeInstanceOf(CameraLabelFitError);
          expect(error.axis).toBe("horizontal");
          expect(error.availablePixels).toBe(176);
          expect(error.projection).toBe(projection);
        }
      })
  );

  it.effect.each(["perspective", "orthographic"] as const)(
    "reports a fixed label taller than the available %s viewport",
    (projection) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          resolveCameraFit({
            bounds: new Box3(new Vector3(-1, -1, 0), new Vector3(1, 1, 0)),
            fov: 50,
            height: 224,
            width: 224,
            position: new Vector3(0, 0, 10),
            target: new Vector3(),
            projection,
            labels: [pixelLabel(0, 0, -7, 7, -90, 90)],
          })
        );
        expect(error).toBeInstanceOf(CameraLabelFitError);
        expect(error.axis).toBe("vertical");
      })
  );
});

describe("camera refitting after content and viewport changes", () => {
  const fitted = {
    distance: 20,
    far: 100,
    near: 0.01,
    position: new Vector3(2, 0, 20),
    radius: 5,
    target: new Vector3(2, 0, 0),
    viewHeight: 10,
  };
  const options = {
    authoredPosition: new Vector3(0, 0, 10),
    authoredTarget: new Vector3(),
    currentPosition: new Vector3(5, 2, 5),
    currentTarget: new Vector3(5, 2, 0),
    currentZoom: 1.5,
    fitted,
    initialZoom: { zoom: 2, minZoom: 0.5, maxZoom: 4 },
    limits: { minDistance: 3, maxDistance: 30 },
  };

  it("uses the authored viewing direction for the first finite-content fit", () => {
    const result = resolveCameraRefit({ ...options, previous: null });
    expect(result.position.toArray()).toEqual([2, 0, 20]);
    expect(result.target.toArray()).toEqual([2, 0, 0]);
    expect(result.zoom).toBe(2);
    expect(result.near).toBe(0.01);
    expect(result.far).toBe(100);
    expect(options.authoredPosition.toArray()).toEqual([0, 0, 10]);
    expect(options.authoredTarget.toArray()).toEqual([0, 0, 0]);
  });

  it("preserves orbit, pan, dolly, and zoom ratios without mutating the old pose", () => {
    const previous = { distance: 10, target: new Vector3(), zoom: 1 };
    const result = resolveCameraRefit({ ...options, previous });
    expect(result.position.toArray()).toEqual([12, 4, 10]);
    expect(result.target.toArray()).toEqual([12, 4, 0]);
    expect(result.zoom).toBe(3);
    expect(options.currentPosition.toArray()).toEqual([5, 2, 5]);
    expect(options.currentTarget.toArray()).toEqual([5, 2, 0]);
    expect(previous.target.toArray()).toEqual([0, 0, 0]);
    expect(fitted.target.toArray()).toEqual([2, 0, 0]);
  });

  it.each([
    { distance: 100, zoom: 10, expectedDistance: 30, expectedZoom: 4 },
    { distance: 0.1, zoom: 0.1, expectedDistance: 3, expectedZoom: 0.5 },
  ])(
    "clamps refits at the configured interaction limits: $distance",
    ({ distance, zoom, expectedDistance, expectedZoom }) => {
      const result = resolveCameraRefit({
        ...options,
        currentPosition: new Vector3(0, 0, distance),
        currentTarget: new Vector3(),
        currentZoom: zoom,
        far: 500,
        near: 0.25,
        previous: { distance: 10, target: new Vector3(), zoom: 1 },
      });
      expect(result.position.distanceTo(result.target)).toBe(expectedDistance);
      expect(result.zoom).toBe(expectedZoom);
      expect(result.near).toBe(0.25);
      expect(result.far).toBe(500);
    }
  );
});

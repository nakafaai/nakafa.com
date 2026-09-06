// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  resolveCameraFit,
  resolveCameraPanOffset,
  resolveCameraRefit,
} from "@repo/design-system/lib/geometry/camera/fit";
import { Box3, OrthographicCamera, PerspectiveCamera, Vector3 } from "three";

describe("finite camera framing", () => {
  it.each([
    { width: 284, height: 320, position: new Vector3(0, 0, 4) },
    { width: 840, height: 460, position: new Vector3(0, 0, 4) },
    { width: 320, height: 460, position: new Vector3(8, 5, 11) },
    { width: 840, height: 460, position: new Vector3(0, 10, 0) },
  ])(
    "fits offset geometry and label extents at $width by $height",
    ({ width, height, position }) => {
      const bounds = new Box3(
        new Vector3(-0.12, -0.3, -0.1),
        new Vector3(3.1, 1.4, 0.1)
      );
      const original = bounds.clone();
      const fit = resolveCameraFit({
        bounds,
        fov: 50,
        height,
        position,
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
    }
  );

  it.each([284, 840])(
    "fits an orthographic frame without stretching at %i pixels",
    (width) => {
      const height = 400;
      const bounds = new Box3(new Vector3(-6, -1, 0), new Vector3(6, 1, 0));
      const fit = resolveCameraFit({
        bounds,
        fov: 50,
        height,
        position: new Vector3(0, 0, 5),
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
      const xUnit = new Vector3(1, 0, 0).project(camera).sub(origin).x * width;
      const yUnit = new Vector3(0, 1, 0).project(camera).sub(origin).y * height;
      expect(xUnit).toBeCloseTo(yUnit);
    }
  );

  it("scales the camera with source units and keeps a point view finite", () => {
    const makeFit = (scale: number) =>
      resolveCameraFit({
        bounds: new Box3(
          new Vector3(-scale, -scale, -scale),
          new Vector3(scale, scale, scale)
        ),
        fov: 45,
        height: 400,
        position: new Vector3(4, 3, 5),
        target: new Vector3(),
        width: 600,
      });
    expect(makeFit(10_000).distance / makeFit(1).distance).toBeCloseTo(10_000);
    const point = resolveCameraFit({
      bounds: new Box3(new Vector3(3, 4, 5), new Vector3(3, 4, 5)),
      fov: 45,
      height: 30,
      position: new Vector3(0, 0, 4),
      target: new Vector3(),
      width: 30,
    });
    expect(point.distance).toBeGreaterThan(0);
    expect(point.viewHeight).toBeGreaterThan(0);
  });

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

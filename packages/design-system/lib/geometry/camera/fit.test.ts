// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  resolveCameraFit,
  resolveCameraPanOffset,
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

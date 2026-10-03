// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  resolveAuthoredView,
  resolveCameraDistanceLimits,
  resolveOrthographicZoom,
} from "@repo/design-system/lib/geometry/camera";
import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";

describe("scene camera limits", () => {
  it("keeps the triangle readable after zooming out from its initial view", () => {
    const position = [0, 0, 4] satisfies [number, number, number];
    const target = [0, 0, 0] satisfies [number, number, number];
    const limits = resolveCameraDistanceLimits({ position, target });
    const camera = new PerspectiveCamera(50, 1);
    camera.position.set(...position);
    camera.lookAt(...target);
    camera.updateMatrixWorld();
    const initialWidth = new Vector3(1, 0, 0).project(camera).x;

    camera.position.z = limits.maxDistance;
    camera.updateMatrixWorld();
    const zoomedOutWidth = new Vector3(1, 0, 0).project(camera).x;

    expect(limits).toEqual({ maxDistance: 6, minDistance: 1 });
    expect(zoomedOutWidth / initialWidth).toBeCloseTo(2 / 3);
  });

  it("measures from the camera target and retains tighter scene limits", () => {
    expect(
      resolveCameraDistanceLimits({
        maxDistance: 5,
        minDistance: 2,
        position: [12, 9, 15],
        target: [12, 9, 11],
      })
    ).toEqual({ maxDistance: 5, minDistance: 2 });
  });

  it("caps loose limits without imposing a fixed world-unit ceiling", () => {
    expect(
      resolveCameraDistanceLimits({
        maxDistance: 100,
        position: [0, 0, 4],
        target: [0, 0, 0],
      }).maxDistance
    ).toBe(6);
    expect(
      resolveCameraDistanceLimits({
        position: [0, 0, 10_000],
        target: [0, 0, 0],
      }).maxDistance
    ).toBe(15_000);
  });

  it("preserves initial framing when responsive cameras exceed old bounds", () => {
    expect(
      resolveCameraDistanceLimits({
        maxDistance: 3,
        minDistance: 7,
        position: [3, 4, 0],
        target: [0, 0, 0],
      })
    ).toEqual({ maxDistance: 5, minDistance: 5 });
  });

  it.each([320, 640])(
    "keeps the same orthographic world extent in a %i-pixel canvas",
    (canvasHeight) => {
      const { minZoom, zoom } = resolveOrthographicZoom(24, canvasHeight);
      const camera = new OrthographicCamera(
        -canvasHeight / 2,
        canvasHeight / 2,
        canvasHeight / 2,
        -canvasHeight / 2
      );
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
      const initialHeight = new Vector3(0, 6, 0).project(camera).y;

      camera.zoom = minZoom;
      camera.updateProjectionMatrix();
      const zoomedOutHeight = new Vector3(0, 6, 0).project(camera).y;

      expect(zoomedOutHeight / initialHeight).toBeCloseTo(2 / 3);
      expect((camera.top - camera.bottom) / minZoom).toBeCloseTo(36);
    }
  );
});

describe("authored camera views", () => {
  it.each([
    { height: 320, width: 320 },
    { height: 320, width: 458 },
  ])(
    "keeps the authored view on a $width by $height canvas",
    ({ height, width }) => {
      expect(resolveAuthoredView({ fov: 50, height, width })).toEqual({
        extent: height,
        fov: 50,
      });
    }
  );

  it("keeps a square frame's sides on a portrait perspective canvas", () => {
    const { fov } = resolveAuthoredView({ fov: 50, height: 640, width: 342 });
    const square = new PerspectiveCamera(50, 1);
    const portrait = new PerspectiveCamera(fov, 342 / 640);
    for (const camera of [square, portrait]) {
      camera.position.set(0, 0, 10);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
    }
    // The right edge of the square view on the plane the camera looks at.
    const edge = new Vector3(10 * Math.tan((50 * Math.PI) / 360), 0, 0);

    expect(edge.clone().project(square).x).toBeCloseTo(1);
    expect(edge.clone().project(portrait).x).toBeCloseTo(1);
    expect(fov).toBeGreaterThan(50);
  });

  it("spans an orthographic view height across a portrait canvas's width", () => {
    const { extent } = resolveAuthoredView({
      fov: 50,
      height: 640,
      width: 342,
    });
    const { zoom } = resolveOrthographicZoom(24, extent);
    const camera = new OrthographicCamera(-171, 171, 320, -320);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();

    expect(extent).toBe(342);
    expect((camera.right - camera.left) / zoom).toBeCloseTo(24);
  });
});

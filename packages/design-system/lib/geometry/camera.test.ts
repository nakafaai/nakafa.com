// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
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

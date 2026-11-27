import { describe, expect, it } from "@effect/vitest";
import { resolveCameraRefit } from "@repo/design-system/components/three/camera/refit";
import { Vector3 } from "three";

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

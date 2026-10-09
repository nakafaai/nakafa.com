import { describe, expect, it } from "@effect/vitest";
import type { Size } from "@react-three/fiber";
import {
  isBehindCamera,
  isNearerThanHit,
  objectScale,
  objectZIndex,
  projectToOverlay,
} from "@repo/design-system/components/three/overlay/project";
import { Camera, OrthographicCamera, PerspectiveCamera, Vector3 } from "three";

const SIZE: Size = { width: 200, height: 100, top: 0, left: 0 };
const Z_RANGE = [1, 0] as const;

/**
 * A 90 degree perspective camera at z = 10 looking down -z. Its tangent is 1,
 * so a point one unit to the side at distance d lands 1/d of the half width
 * from the center.
 */
function perspectiveCamera() {
  const camera = new PerspectiveCamera(90, 1, 1, 100);
  camera.position.set(0, 0, 10);
  camera.updateMatrixWorld();
  return camera;
}

/** An orthographic camera at z = 10 whose view is 100 by 50 units. */
function orthographicCamera() {
  const camera = new OrthographicCamera(-50, 50, 25, -25, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.updateMatrixWorld();
  return camera;
}

function expectPoint(
  actual: readonly [number, number],
  expected: readonly [number, number]
) {
  expect(actual[0]).toBeCloseTo(expected[0], 9);
  expect(actual[1]).toBeCloseTo(expected[1], 9);
}

describe("projectToOverlay", () => {
  it("places the view center at the middle of the canvas", () => {
    expectPoint(
      projectToOverlay(new Vector3(0, 0, 0), perspectiveCamera(), SIZE),
      [100, 50]
    );
  });

  it("moves a point in front of a perspective camera by its scaled offset", () => {
    const camera = perspectiveCamera();

    expectPoint(
      projectToOverlay(new Vector3(1, 0, 0), camera, SIZE),
      [110, 50]
    );
    expectPoint(
      projectToOverlay(new Vector3(0, 1, 0), camera, SIZE),
      [100, 45]
    );
  });

  it("mirrors a point behind a perspective camera across the view center", () => {
    expectPoint(
      projectToOverlay(new Vector3(1, 0, 20), perspectiveCamera(), SIZE),
      [90, 50]
    );
  });

  it("ignores depth for an orthographic camera", () => {
    const camera = orthographicCamera();

    expectPoint(
      projectToOverlay(new Vector3(10, 5, 0), camera, SIZE),
      [120, 40]
    );
    expectPoint(
      projectToOverlay(new Vector3(10, 5, 20), camera, SIZE),
      [120, 40]
    );
  });
});

describe("isBehindCamera", () => {
  it("keeps a point in front of a perspective camera visible", () => {
    expect(isBehindCamera(new Vector3(1, 0, 0), perspectiveCamera())).toBe(
      false
    );
  });

  it("hides a point behind a perspective camera", () => {
    expect(isBehindCamera(new Vector3(1, 0, 20), perspectiveCamera())).toBe(
      true
    );
  });

  it("keeps a point in front of an orthographic camera visible", () => {
    expect(isBehindCamera(new Vector3(10, 5, 0), orthographicCamera())).toBe(
      false
    );
  });

  it("hides a point behind an orthographic camera", () => {
    expect(isBehindCamera(new Vector3(10, 5, 20), orthographicCamera())).toBe(
      true
    );
  });
});

describe("objectScale", () => {
  it("uses one pixel of world size at the distance of a point in front", () => {
    // Distance 20 gives 1 / (2 * tan(45 degrees) * 20) = 1 / 40.
    expect(
      objectScale(new Vector3(0, 0, -10), perspectiveCamera())
    ).toBeCloseTo(0.025, 12);
  });

  it("uses the distance of a point behind a perspective camera too", () => {
    // Distance 10 gives 1 / (2 * tan(45 degrees) * 10) = 1 / 20.
    expect(objectScale(new Vector3(0, 0, 20), perspectiveCamera())).toBeCloseTo(
      0.05,
      12
    );
  });

  it("returns the zoom of an orthographic camera", () => {
    const camera = orthographicCamera();
    camera.zoom = 2;

    expect(objectScale(new Vector3(10, 5, 0), camera)).toBe(2);
  });

  it("returns one for a camera with no projection of its own", () => {
    expect(objectScale(new Vector3(0, 0, 0), new Camera())).toBe(1);
  });
});

describe("objectZIndex", () => {
  it("maps the near plane onto the first value of the range", () => {
    // Distance 1 is the near plane of the perspective camera (near = 1).
    expect(
      objectZIndex(new Vector3(0, 0, 9), perspectiveCamera(), Z_RANGE)
    ).toBe(1);
  });

  it("maps the far plane onto the second value of the range", () => {
    // Distance 100 is the far plane of the perspective camera (far = 100).
    expect(
      objectZIndex(new Vector3(0, 0, -90), perspectiveCamera(), Z_RANGE)
    ).toBe(0);
  });

  it("keeps a near point above a far point by rounding the linear map", () => {
    // Distance 10 maps to 0.909 and distance 60 maps to 0.404.
    const camera = perspectiveCamera();

    expect(objectZIndex(new Vector3(0, 0, 0), camera, Z_RANGE)).toBe(1);
    expect(objectZIndex(new Vector3(0, 0, -50), camera, Z_RANGE)).toBe(0);
  });

  it("uses the distance of a point behind a perspective camera too", () => {
    // Distance 10 from the camera, behind it, maps to 0.909 as in front.
    expect(
      objectZIndex(new Vector3(0, 0, 20), perspectiveCamera(), Z_RANGE)
    ).toBe(1);
  });

  it("maps an orthographic camera's near and far planes the same way", () => {
    // Distance 10 maps to 0.901 and distance 60 maps to 0.400 (near = 0.1, far = 100).
    const camera = orthographicCamera();

    expect(objectZIndex(new Vector3(0, 0, 0), camera, Z_RANGE)).toBe(1);
    expect(objectZIndex(new Vector3(0, 0, -50), camera, Z_RANGE)).toBe(0);
  });

  it("has no depth order for a camera without near and far planes", () => {
    expect(
      objectZIndex(new Vector3(0, 0, 0), new Camera(), Z_RANGE)
    ).toBeUndefined();
  });
});

describe("isNearerThanHit", () => {
  it("keeps a label visible when the camera ray hits nothing", () => {
    expect(isNearerThanHit(7, undefined)).toBe(true);
  });

  it("keeps a label in front of the nearest hit", () => {
    expect(isNearerThanHit(3, 5)).toBe(true);
  });

  it("hides a label behind the nearest hit", () => {
    expect(isNearerThanHit(7, 5)).toBe(false);
  });

  it("hides a label at the same distance as the hit", () => {
    expect(isNearerThanHit(5, 5)).toBe(false);
  });
});

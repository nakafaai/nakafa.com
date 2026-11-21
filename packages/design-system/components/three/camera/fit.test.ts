import { describe, expect, it } from "@effect/vitest";
import {
  cameraFitKey,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
} from "@repo/design-system/components/three/camera/fit";
import { Box2, Box3, Vector2, Vector3 } from "three";

describe("cameraFitKey", () => {
  it("serializes bounds, labels, camera pose, and optional limits consistently", () => {
    const base = {
      authoredPosition: new Vector3(...DEFAULT_CAMERA_POSITION),
      authoredTarget: new Vector3(...DEFAULT_CAMERA_TARGET),
      bounds: new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1)),
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
      viewportHeight: 600,
      viewportWidth: 800,
    };

    const first = cameraFitKey(base);
    const second = cameraFitKey({ ...base, maxDistance: 40, minDistance: 2 });

    expect(first).toBe(cameraFitKey(base));
    expect(second).not.toBe(first);
    expect(second).toContain(",2,40");
  });
});

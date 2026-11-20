import { describe, expect, it } from "@effect/vitest";
import { createAxisGeometry } from "@repo/design-system/components/three/frame";

describe("axis geometry", () => {
  it("runs each axis through the origin across the whole reach", () => {
    const axes = createAxisGeometry(30, { x: 1.5, y: -2, z: 0 });

    expect(axes.x).toStrictEqual({
      from: { x: -30, y: -2, z: 0 },
      to: { x: 30, y: -2, z: 0 },
      visible: true,
    });
    expect(axes.y).toStrictEqual({
      from: { x: 1.5, y: -30, z: 0 },
      to: { x: 1.5, y: 30, z: 0 },
      visible: true,
    });
    expect(axes.z).toStrictEqual({
      from: { x: 1.5, y: -2, z: -30 },
      to: { x: 1.5, y: -2, z: 30 },
      visible: true,
    });
  });

  it("centres the axes on the world's origin by default", () => {
    expect(createAxisGeometry(100).x.from).toStrictEqual({
      x: -100,
      y: 0,
      z: 0,
    });
  });

  it("draws no axis whose line misses the reach, such as the x axis of a frame far above zero", () => {
    // A frame from y = 35 to 39 puts the origin 92 world units below the world's center.
    const axes = createAxisGeometry(30, { x: 0, y: -92, z: 0 });

    expect(axes.x.visible).toBe(false);
    expect(axes.z.visible).toBe(false);
    expect(axes.y.visible).toBe(true);
  });
});

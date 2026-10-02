import { describe, expect, it } from "@effect/vitest";
import {
  packLines,
  unpackLines,
} from "@repo/design-system/components/contents/mathematics/line/pack";
import type { AuthoredLine } from "@repo/design-system/components/contents/mathematics/line/spec";
import { Schema } from "effect";

const parabola = Array.from({ length: 5 }, (_, index) => {
  const x = -2.5 + (index / 134) * 5;
  return { x, y: x * x, z: 0 };
});

describe("line packing", () => {
  it("carries point lines as flat coordinates at float precision", () => {
    const [packed] = packLines([
      { color: "#9333ea", points: parabola, showPoints: false, smooth: false },
    ]);

    expect(packed).toEqual({
      color: "#9333ea",
      coordinates: [
        -2.5, 6.25, 0, -2.462_686_5, 6.064_825, 0, -2.425_373, 5.882_435, 0,
        -2.388_059_6, 5.702_829_4, 0, -2.350_746_2, 5.526_008, 0,
      ],
      showPoints: false,
      smooth: false,
    });
  });

  it("restores every point as the float WebGL draws it", () => {
    const [line] = unpackLines(packLines([{ points: parabola }]));

    expect(line).toEqual({ points: expect.any(Array) });
    const points = "points" in line ? line.points : [];
    expect(points).toHaveLength(parabola.length);
    points.forEach((point, index) => {
      const authored = parabola[index];
      expect(Math.fround(point.x)).toBe(Math.fround(authored.x));
      expect(Math.fround(point.y)).toBe(Math.fround(authored.y));
      expect(point.z).toBe(0);
    });
  });

  it("keeps the nine digits a float needs at most", () => {
    const [packed] = packLines([
      { points: [{ x: 0.123_042_315_244_674_68, y: 1 / 3, z: 2 }] },
    ]);

    expect(packed).toEqual({ coordinates: [0.123_042_315, 0.333_333_34, 2] });
  });

  it("leaves declarative lines as written", () => {
    const circle: AuthoredLine = {
      color: "#0d9488",
      kind: "circle-outline",
      radius: 3,
    };

    const packed = packLines([circle]);

    expect(packed[0]).toBe(circle);
    expect(unpackLines(packed)[0]).toBe(circle);
  });

  it.prop(
    "restores any coordinate as the same float",
    [Schema.Finite, Schema.Finite, Schema.Finite],
    ([x, y, z]) => {
      const [line] = unpackLines(packLines([{ points: [{ x, y, z }] }]));
      const [point] = "points" in line ? line.points : [];

      expect(Math.fround(point.x)).toBe(Math.fround(x));
      expect(Math.fround(point.y)).toBe(Math.fround(y));
      expect(Math.fround(point.z)).toBe(Math.fround(z));
    }
  );
});

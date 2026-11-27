import { describe, expect, it } from "@effect/vitest";
import {
  frostAt,
  paintFrost,
} from "@repo/design-system/components/contents/physics/kinematics/sling/frost";
import { Array as Arr } from "effect";

describe("frostAt", () => {
  const places = Arr.flatMap(Arr.range(0, 23), (row) =>
    Arr.map(Arr.range(0, 23), (column) => frostAt(column / 24, row / 24))
  );

  it("stays between clear ice and white frost", () => {
    expect(Math.min(...places)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...places)).toBeLessThanOrEqual(1);
  });

  it("leaves some ice clear and frosts some over", () => {
    expect(Math.min(...places)).toBeLessThan(0.1);
    expect(Math.max(...places)).toBeGreaterThan(0.5);
  });
});

describe("paintFrost", () => {
  it("paints opaque grey pixels, lighter where the ice is frosted", () => {
    const pixels = paintFrost(8);
    expect(pixels).toHaveLength(8 * 8 * 4);
    expect(pixels[0]).toBe(Math.round(110 + 145 * frostAt(0.5 / 8, 0.5 / 8)));
    expect(pixels[1]).toBe(pixels[0]);
    expect(pixels[2]).toBe(pixels[0]);
    expect(pixels[3]).toBe(255);
  });
});

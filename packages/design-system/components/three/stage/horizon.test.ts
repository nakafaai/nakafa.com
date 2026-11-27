import { describe, expect, it } from "@effect/vitest";
import { horizonColor } from "@repo/design-system/components/three/stage/horizon";
import { Array as Arr } from "effect";
import { DataUtils } from "three";

/** Builds a half-float image of one-color rows, from the ground row up. */
function image(width: number, rows: readonly (readonly number[])[]) {
  const pixel = (rgb: readonly number[]) =>
    Arr.map([...rgb, 1], (value) => DataUtils.toHalfFloat(value));
  return Uint16Array.from(
    Arr.flatMap(rows, (rgb) => Arr.flatten(Arr.replicate(pixel(rgb), width)))
  );
}

describe("horizonColor", () => {
  it("averages only the sky just above the horizon and scales it by the exposure", () => {
    // 90 rows span 180 degrees, so 8 to 24 degrees above the horizon is rows 49 to 56.
    const rows = Arr.makeBy(90, (row) => {
      if (row < 49) {
        return [8, 8, 8];
      }
      return row < 57 ? [0.25, 0.5, 0.125] : [0, 0, 0];
    });

    const color = horizonColor(image(2, rows), 2, 90, 2);

    expect(color.r).toBeCloseTo(0.5, 3);
    expect(color.g).toBeCloseTo(1, 3);
    expect(color.b).toBeCloseTo(0.25, 3);
  });

  it("reads at least one row above the horizon on a tiny image", () => {
    const color = horizonColor(
      image(1, [
        [1, 1, 1],
        [3, 3, 3],
      ]),
      1,
      2,
      1
    );

    expect(color.r).toBeCloseTo(3, 3);
  });
});

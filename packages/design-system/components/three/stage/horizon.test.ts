import { describe, expect, it } from "@effect/vitest";
import { horizonColor } from "@repo/design-system/components/three/stage/horizon";
import { Array as Arr } from "effect";
import { DataUtils } from "three";

/** Builds a half-float image of one-color rows, from the top row down. */
function image(width: number, rows: readonly (readonly number[])[]) {
  const pixel = (rgb: readonly number[]) =>
    Arr.map([...rgb, 1], (value) => DataUtils.toHalfFloat(value));
  return Uint16Array.from(
    Arr.flatMap(rows, (rgb) => Arr.flatten(Arr.replicate(pixel(rgb), width)))
  );
}

describe("horizonColor", () => {
  it("averages only the rows near the horizon and scales them by the exposure", () => {
    // 90 rows span 180 degrees, so eight degrees each way is rows 41 to 48.
    const rows = Arr.makeBy(90, (row) => {
      if (row < 41) {
        return [8, 8, 8];
      }
      return row < 49 ? [0.25, 0.5, 0.125] : [0, 0, 0];
    });

    const color = horizonColor(image(2, rows), 2, 90, 2);

    expect(color.r).toBeCloseTo(0.5, 3);
    expect(color.g).toBeCloseTo(1, 3);
    expect(color.b).toBeCloseTo(0.25, 3);
  });

  it("reads at least one row each way on a tiny image", () => {
    const color = horizonColor(
      image(1, [
        [1, 1, 1],
        [3, 3, 3],
      ]),
      1,
      2,
      1
    );

    expect(color.r).toBeCloseTo(2, 3);
  });
});

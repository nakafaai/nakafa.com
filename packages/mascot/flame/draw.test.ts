import { describe, expect, it } from "@effect/vitest";
import { TEXT } from "@repo/mascot/color";
import { EMBER_BOX, ember, flame, flameBox } from "@repo/mascot/flame/draw";
import type { Shape } from "@repo/mascot/shape";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Order } from "effect";

/** Every colour a picture paints with, through its groups. */
function colours(shapes: readonly Shape[]): readonly string[] {
  return Arr.flatMap(shapes, (shape) =>
    shape._tag === "g"
      ? colours(shape.children)
      : Arr.filter(
          [shape.fill, shape.stroke],
          (colour): colour is string =>
            colour !== undefined && colour !== "none"
        )
  );
}

/** How many shapes a picture draws, through its groups. */
function count(shapes: readonly Shape[]): number {
  return Arr.reduce(
    shapes,
    0,
    (sum, shape) => sum + (shape._tag === "g" ? count(shape.children) : 1)
  );
}

describe("mascot/flame", () => {
  it("draws a fire that is out only in the colour of the text round it", () => {
    expect(Arr.dedupe(colours(flame(0)))).toEqual([TEXT]);
    expect(flameBox(0)).toEqual([29, 34, 62, 88]);
  });

  it("frames each flame in a window that widens and rises with it, and stands on its foot", () => {
    const boxes = Arr.map([1, 3, 5, 7, 9], flameBox);
    const widths = Arr.map(boxes, (box) => box[2]);
    const heights = Arr.map(boxes, (box) => box[3]);
    expect(widths).toEqual(Arr.sort(widths, Order.Number));
    expect(heights).toEqual(Arr.sort(heights, Order.Number));
    for (const box of boxes) {
      expect(box[1] + box[3]).toBe(123);
    }
    expect(flameBox(40)).toEqual(flameBox(9));
  });

  it("draws a greater flame at every stage up to the ninth, never a lesser one, and the same each time", () => {
    const stages = Arr.map(Arr.range(1, 9), (stage) => flame(stage));
    expect(
      Arr.dedupe(Arr.map(stages, (picture) => encodeJsonText(picture)))
    ).toHaveLength(9);
    const sizes = Arr.map(Arr.range(1, 8), (stage) => count(flame(stage)));
    expect(sizes).toEqual(Arr.sort(sizes, Order.Number));
    expect(count(flame(8))).toBeGreaterThan(count(flame(1)));
    expect(flame(4)).toEqual(flame(4));
    for (const picture of stages) {
      expect(colours(picture)).not.toContain(TEXT);
    }
  });

  it("draws a day as a small flame once learned on, and as cold coals in the text's colour until then", () => {
    expect(colours(ember(true))).not.toContain(TEXT);
    expect(Arr.dedupe(colours(ember(false)))).toEqual([TEXT]);
    expect(EMBER_BOX[2]).toBeLessThan(flameBox(9)[2]);
  });

  it("keeps its full form past the last change, however long the run", () => {
    expect(flame(40)).toEqual(flame(9));
  });
});

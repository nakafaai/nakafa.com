import { describe, expect, it } from "@effect/vitest";
import { bowl, head } from "@repo/design-system/components/three/form/outline";
import { Array as Arr, Option } from "effect";

describe("bowl", () => {
  it("runs from the pole out and up to the rim along a quarter of an ellipse", () => {
    const outline = bowl(0.008, 0.008);
    expect(outline[0]).toEqual([0, 0]);
    const rim = Option.getOrThrow(Arr.last(outline));
    expect(rim[0]).toBeCloseTo(0.008, 12);
    expect(rim[1]).toBeCloseTo(0.008, 12);
    for (const [radius, height] of outline) {
      expect(Math.hypot(radius, 0.008 - height)).toBeCloseTo(0.008, 9);
    }
  });
});

describe("head", () => {
  it("stands a flat flange out past the rim, then domes from the flange to the pole", () => {
    const outline = head(0.09, 0.056, [0.012, 0.014]);
    expect(outline[0]).toEqual([0.102, 0]);
    expect(outline[1]).toEqual([0.102, 0.014]);
    expect(outline[2][0]).toBeCloseTo(0.09, 12);
    expect(outline[2][1]).toBeCloseTo(0.014, 12);
    expect(Option.getOrThrow(Arr.last(outline))).toEqual([0, 0.056]);
    for (const [radius, height] of Arr.drop(outline, 2)) {
      expect(
        (radius / 0.09) ** 2 + ((height - 0.014) / 0.042) ** 2
      ).toBeCloseTo(1, 9);
    }
  });
});

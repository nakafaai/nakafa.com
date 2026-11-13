// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Record as Rec } from "effect";
import { colorOf, RAMPS, rgbOf, toneOf } from "@/lib/island/palette";

describe("island/palette", () => {
  it("reads one tone of a ramp as its red, green and blue", () => {
    expect(colorOf("grass", 0)).toEqual(rgbOf(RAMPS.grass[0]));
    expect(rgbOf("#3d7436")).toEqual([0x3d, 0x74, 0x36]);
  });

  it("orders every ramp from shadow to highlight", () => {
    const luma = (hex: string) => {
      const [red, green, blue] = rgbOf(hex);
      return red * 0.3 + green * 0.59 + blue * 0.11;
    };
    for (const ramp of Rec.values(RAMPS)) {
      expect(luma(ramp[0])).toBeLessThan(luma(ramp[3]));
    }
  });

  it("splits [0, 1) into four equal bands of tone", () => {
    expect(Arr.map([0, 0.3, 0.6, 0.9], toneOf)).toEqual([0, 1, 2, 3]);
  });
});

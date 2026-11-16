// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Schema } from "effect";
import { RAMPS, rgbOf } from "@/lib/island/palette";
import { repaintFor, Season, seasonNow, seasonOf } from "@/lib/island/season";

/** One pixel of a ramp's tone, followed by one of a color no ramp of the grass or leaves holds. */
function pixelsOf(hex: string) {
  return new Uint8ClampedArray([...rgbOf(hex), 255, 1, 2, 3, 255]);
}

describe("island/season", () => {
  it("turns a tropical year between wet and dry, and a temperate one through four seasons, half a year apart south of the tropics", () => {
    expect(seasonOf(1, "Asia/Jakarta")).toBe("wet");
    expect(seasonOf(7, "Asia/Jakarta")).toBe("dry");
    expect(seasonOf(11, "Asia/Kuala_Lumpur")).toBe("wet");
    expect(seasonOf(4, "Europe/Berlin")).toBe("spring");
    expect(seasonOf(7, "Europe/Berlin")).toBe("summer");
    expect(seasonOf(10, "Europe/Berlin")).toBe("autumn");
    expect(seasonOf(1, "Europe/Berlin")).toBe("winter");
    expect(seasonOf(12, "Europe/Berlin")).toBe("winter");
    expect(seasonOf(7, "Australia/Sydney")).toBe("winter");
    expect(seasonOf(1, "America/Argentina/Buenos_Aires")).toBe("summer");
    expect(Schema.is(Season)(seasonNow())).toBe(true);
  });

  it("lays snow on the grass in winter, turns the leaves in autumn, and leaves the summer and wet palettes and every other color alone", () => {
    const winter = repaintFor(pixelsOf(RAMPS.grass[3]), "winter");
    expect(Arr.fromIterable(winter.subarray(0, 3))).toEqual([251, 253, 255]);
    expect(Arr.fromIterable(winter.subarray(4, 7))).toEqual([1, 2, 3]);
    const autumn = repaintFor(pixelsOf(RAMPS.leaf[0]), "autumn");
    expect(Arr.fromIterable(autumn.subarray(0, 3))).toEqual(rgbOf("#7a2f1c"));
    const summer = pixelsOf(RAMPS.grass[1]);
    expect(repaintFor(summer, "summer")).toBe(summer);
    expect(repaintFor(pixelsOf(RAMPS.grass[1]), "wet")).toEqual(
      pixelsOf(RAMPS.grass[1])
    );
  });
});

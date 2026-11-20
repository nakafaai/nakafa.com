// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { colorOf, RAMPS, rgbOf } from "@/lib/island/palette";
import {
  leafToneOf,
  Season,
  seasonNow,
  seasonOf,
  turfOf,
} from "@/lib/island/season";

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

  it("keeps the palette's own leaves in summer and the wet season, and turns them with every other season", () => {
    for (const tone of [0, 1, 2, 3] as const) {
      expect(leafToneOf("summer", tone)).toEqual(colorOf("leaf", tone));
      expect(leafToneOf("wet", tone)).toEqual(colorOf("leaf", tone));
    }
    const [red, green] = leafToneOf("autumn", 2);
    expect(red).toBeGreaterThan(green);
    const [snowRed, snowGreen, snowBlue] = leafToneOf("winter", 3);
    expect(Math.min(snowRed, snowGreen, snowBlue)).toBeGreaterThan(230);
    expect(leafToneOf("spring", 1)).not.toEqual(leafToneOf("dry", 1));
  });

  it("leaves the turf as painted in summer and the wet season, dries it, turns it and pales it in the others", () => {
    expect(turfOf("summer")).toEqual([1, 1, 1]);
    expect(turfOf("wet")).toEqual([1, 1, 1]);
    const own = rgbOf(RAMPS.grass[2]);
    const tinted = (season: Season) => {
      const turf = turfOf(season);
      return [own[0] * turf[0], own[1] * turf[1], own[2] * turf[2]] as const;
    };
    // The palette's grass is green before any season touches it.
    expect(own[1]).toBeGreaterThan(own[0]);
    expect(own[1]).toBeGreaterThan(own[2]);
    // Winter pales it toward snow: every channel lighter, the blue most of all.
    const winter = turfOf("winter");
    expect(Math.min(...winter)).toBeGreaterThan(1);
    expect(winter[2]).toBeGreaterThan(winter[1]);
    expect(Math.min(...tinted("winter"))).toBeGreaterThan(200);
    // The dry season and autumn yellow it: more red for the same green than the palette's own.
    for (const season of ["dry", "autumn"] as const) {
      const [red, green, blue] = tinted(season);
      expect(red / green).toBeGreaterThan(own[0] / own[1]);
      expect(green).toBeGreaterThan(blue);
    }
    // Spring keeps it green, and is no other season's turf.
    const spring = tinted("spring");
    expect(spring[1]).toBeGreaterThan(spring[0]);
    expect(turfOf("spring")).not.toEqual(turfOf("autumn"));
    expect(turfOf("dry")).not.toEqual(turfOf("autumn"));
  });
});

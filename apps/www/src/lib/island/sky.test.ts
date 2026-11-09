// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { lightOf } from "@/lib/island/sky";

/** How bright a color is. */
const brightness = (color: readonly number[]) => color[0] + color[1] + color[2];

describe("island/sky", () => {
  it("lights noon brightly with no lamps, and midnight dimly with warm lamps", () => {
    const noon = lightOf(12, "clear");
    const midnight = lightOf(0, "clear");
    expect(brightness(noon.sun)).toBeGreaterThan(brightness(midnight.sun) * 3);
    expect(brightness(noon.lamp)).toBe(0);
    expect(midnight.lamp[0]).toBeGreaterThan(midnight.lamp[2]);
    expect(noon.fog).toEqual(noon.horizon);
  });

  it("warms the horizon at dusk and wraps the hours around the day", () => {
    const dusk = lightOf(18.6, "clear");
    expect(dusk.horizon[0]).toBeGreaterThan(dusk.horizon[2]);
    expect(lightOf(25, "clear")).toEqual(lightOf(1, "clear"));
    expect(lightOf(-1, "clear")).toEqual(lightOf(23, "clear"));
  });

  it("dims the sun and greys the sky under clouds, rain and storms", () => {
    const clear = lightOf(12, "clear");
    const storm = lightOf(12, "storm");
    expect(brightness(storm.sun)).toBeLessThan(brightness(clear.sun) / 2);
    const spread = (color: readonly number[]) =>
      Math.max(...color) - Math.min(...color);
    expect(spread(storm.zenith)).toBeLessThan(spread(clear.zenith));
    expect(brightness(lightOf(12, "rain").sun)).toBeLessThan(
      brightness(lightOf(12, "clouds").sun)
    );
    expect(brightness(lightOf(12, "snow").sun)).toBeLessThan(
      brightness(clear.sun)
    );
  });
});

import { describe, expect, it } from "@effect/vitest";
import {
  AIR_SHADER,
  airMass,
  openAir,
  skyGlow,
  sunlight,
} from "@repo/design-system/components/three/sky/air";

const SUN = [0.533, 0.5, 0.682] as const;

describe("airMass", () => {
  it("is one depth of air straight up and about thirty-eight at the horizon", () => {
    expect(airMass(1)).toBeCloseTo(1, 2);
    expect(airMass(0)).toBeGreaterThan(35);
    expect(airMass(0)).toBeLessThan(40);
  });

  it("holds a sun below the horizon or a sine past one at the nearest real height", () => {
    expect(airMass(-0.4)).toBe(airMass(0));
    expect(airMass(1.5)).toBe(airMass(1));
  });
});

describe("sunlight", () => {
  it("is nearly white from high up and reddens as the sun sinks", () => {
    const [, highGreen, highBlue] = sunlight(1);
    const [red, lowGreen, lowBlue] = sunlight(0.05);

    expect(red).toBe(1);
    expect(highBlue).toBeGreaterThan(0.85);
    expect(highGreen).toBeGreaterThan(highBlue);
    expect(lowBlue).toBeLessThan(0.4);
    expect(lowGreen).toBeGreaterThan(lowBlue);
    expect(lowGreen).toBeLessThan(highGreen);
  });
});

describe("skyGlow", () => {
  it("is blue overhead and brighter and paler at the horizon", () => {
    const [zenithRed, , zenithBlue] = skyGlow(1, 0.5, [1, 1, 1]);
    const [horizonRed, , horizonBlue] = skyGlow(0.03, 0.5, [1, 1, 1]);

    expect(zenithBlue).toBeGreaterThan(3 * zenithRed);
    expect(horizonRed).toBeGreaterThan(zenithRed);
    expect(horizonBlue / horizonRed).toBeLessThan(zenithBlue / zenithRed);
  });

  it("brightens around the sun and scales with the light that scatters", () => {
    const away = skyGlow(0.5, -0.2, [1, 1, 1]);
    const near = skyGlow(0.5, 0.98, [1, 1, 1]);
    const dim = skyGlow(0.5, 0.98, [0.5, 0.5, 0.5]);

    expect(near[0]).toBeGreaterThan(away[0]);
    expect(dim[2]).toBeCloseTo(near[2] / 2, 9);
  });

  it("draws a direction under the horizon as the horizon itself", () => {
    expect(skyGlow(-0.3, 0, [1, 1, 1])).toEqual(skyGlow(0, 0, [1, 1, 1]));
  });
});

describe("AIR_SHADER", () => {
  it("gives the graphics card the same sky and dusk", () => {
    expect(AIR_SHADER).toContain(
      "vec3 airGlow(float height, float toward, vec3 glow)"
    );
    expect(AIR_SHADER).toContain("vec3 duskGlow(float height, float facing)");
    expect(AIR_SHADER).toContain("0.0000331");
  });
});

describe("openAir", () => {
  it("reads no air for a place with a roof or with no place at all", () => {
    expect(openAir("lab", SUN, false)).toBeUndefined();
    expect(openAir(undefined, SUN, true)).toBeUndefined();
  });

  it("lights a field by day with the sun's own colour and a pale blue haze", () => {
    const air = openAir("field", SUN, false);

    expect(air?.night).toBe(false);
    expect(air?.light).toEqual(sunlight(SUN[1]));
    expect(air?.glow).toEqual([1, 1, 1]);
    expect(air?.haze[2]).toBeGreaterThan(air?.haze[0] ?? 1);
    expect(air?.haze[0]).toBeGreaterThan(0.3);
  });

  it("turns the open sky to a moonlit dusk on a dark page", () => {
    const day = openAir("sky", SUN, false);
    const night = openAir("sky", SUN, true);

    expect(night?.night).toBe(true);
    expect(night?.light[2]).toBe(1);
    expect(night?.light[0]).toBeLessThan(night?.light[2] ?? 0);
    expect(night?.haze[1]).toBeLessThan((day?.haze[1] ?? 0) / 4);
    expect(night?.glow[2]).toBeLessThan(0.2);
  });
});

import { describe, expect, it } from "@effect/vitest";
import {
  wispDensity,
  wispPixels,
} from "@repo/design-system/components/three/energy/wisp";

describe("wispDensity", () => {
  it("is densest at the middle of the wisp", () => {
    expect(wispDensity(0.5, 0.5)).toBeCloseTo(1, 9);
    expect(wispDensity(0.5, 0.25)).toBeCloseTo(0.5, 9);
  });

  it("thins to clear air at its sides and at both ends", () => {
    expect(wispDensity(0.5, 0)).toBeCloseTo(0, 9);
    expect(wispDensity(0.5, 1)).toBeCloseTo(0, 9);
    expect(wispDensity(0, 0.5)).toBeCloseTo(0, 9);
    expect(wispDensity(1, 0.5)).toBeCloseTo(0, 9);
  });
});

describe("wispPixels", () => {
  it("paints white pixels whose opacity is the smoke's density", () => {
    const pixels = wispPixels(2, 3);
    expect(pixels).toHaveLength(24);
    expect([pixels[0], pixels[1], pixels[2]]).toEqual([255, 255, 255]);
    expect(pixels[3]).toBe(Math.round(255 * wispDensity(1 / 6, 0.25)));
    expect(pixels[11]).toBe(Math.round(255 * wispDensity(0.5, 0.25)));
    expect(pixels[15]).toBe(Math.round(255 * wispDensity(0.5, 0.75)));
    expect(pixels[23]).toBe(Math.round(255 * wispDensity(5 / 6, 0.75)));
  });
});

import { describe, expect, it } from "@effect/vitest";
import {
  isCell,
  paintSolar,
  solarTexture,
} from "@repo/design-system/components/three/surface/solar";

describe("isCell", () => {
  it("leaves a gap of backsheet round each cell and clips its corners", () => {
    expect(isCell(0.5, 0.5)).toBe(true);
    expect(isCell(0.01, 0.5)).toBe(false);
    expect(isCell(0.5, 0.99)).toBe(false);
    expect(isCell(0.05, 0.05)).toBe(false);
  });
});

describe("paintSolar", () => {
  it("paints dark cells, silver busbars and white backsheet", () => {
    const { height, pixels, width } = paintSolar(2, 1);
    const at = (x: number, y: number) => pixels[(y * width + x) * 4] ?? 0;

    expect(width).toBe(96);
    expect(height).toBe(48);
    expect(at(0, 0)).toBeGreaterThan(200);
    expect(at(Math.round(48 * 0.4), 25)).toBeGreaterThan(150);
    expect(at(30, 25)).toBeLessThan(60);
    expect(at(30, 24)).toBeLessThan(60);
  });
});

describe("solarTexture", () => {
  it("paints each layout once", () => {
    expect(solarTexture(2, 1)).toBe(solarTexture(2, 1));
    expect(solarTexture(2, 1).image.width).toBe(96);
  });
});

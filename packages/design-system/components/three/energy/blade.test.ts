import { describe, expect, it } from "@effect/vitest";
import {
  bladeGeometry,
  bladePoint,
  chordAt,
  roundAt,
  twistAt,
} from "@repo/design-system/components/three/energy/blade";
import { Array as Arr } from "effect";

describe("chordAt", () => {
  it("swells from the round root to the shoulder, tapers, and closes at the tip", () => {
    expect(chordAt(0)).toBeCloseTo(0.05, 6);
    expect(chordAt(0.22)).toBeCloseTo(0.092, 6);
    expect(chordAt(0.6)).toBeLessThan(chordAt(0.22));
    expect(chordAt(0.9)).toBeLessThan(chordAt(0.6));
    expect(chordAt(1)).toBeCloseTo(0, 6);
  });
});

describe("roundAt", () => {
  it("is a circle at the root and a full aerofoil from the shoulder out", () => {
    expect(roundAt(0)).toBe(1);
    expect(roundAt(0.22)).toBe(0);
    expect(roundAt(0.8)).toBe(0);
  });
});

describe("twistAt", () => {
  it("turns the root into the wind and leaves the tip its pitch", () => {
    expect(twistAt(0)).toBeCloseTo(0.34, 6);
    expect(twistAt(1)).toBeCloseTo(0.04, 6);
  });
});

describe("bladePoint", () => {
  it("draws the root as a circle as wide as its chord", () => {
    const radii = Arr.map([0, 0.13, 0.4, 0.77], (round) => {
      const [x, , z] = bladePoint(0, round);
      return Math.hypot(x, z);
    });
    expect(Math.min(...radii)).toBeCloseTo(0.025, 6);
    expect(Math.max(...radii)).toBeCloseTo(0.025, 6);
  });

  it("draws a thin aerofoil outboard with its leading edge toward +x", () => {
    const [trailing] = bladePoint(0.6, 0);
    const [leading] = bladePoint(0.6, 0.5);
    const [, , downwind] = bladePoint(0.6, 0.25);
    const [, , upwind] = bladePoint(0.6, 0.75);
    expect(leading).toBeGreaterThan(0);
    expect(trailing).toBeLessThan(0);
    expect(leading - trailing).toBeCloseTo(
      chordAt(0.6) * Math.cos(twistAt(0.6)),
      3
    );
    expect(upwind).toBeGreaterThan(downwind);
    expect(upwind - downwind).toBeLessThan(0.3 * chordAt(0.6));
  });

  it("bends the tip upwind of the root", () => {
    expect(bladePoint(1, 0.5)[2]).toBeCloseTo(0.035, 3);
  });
});

describe("bladeGeometry", () => {
  it("lofts a blade of the asked length whose faces look outward", () => {
    const geometry = bladeGeometry(2);
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.max.y).toBeCloseTo(2, 6);
    expect(geometry.boundingBox?.min.y).toBeCloseTo(0, 6);
    const leading = 28 * 41 + 20;
    expect(position.getX(leading)).toBeGreaterThan(0);
    expect(normal.getX(leading)).toBeGreaterThan(0.8);
  });
});

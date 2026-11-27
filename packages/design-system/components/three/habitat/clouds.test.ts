import { describe, expect, it } from "@effect/vitest";
import {
  cloudCover,
  paintClouds,
  stormAt,
  stormsOf,
} from "@repo/design-system/components/three/habitat/clouds";
import { Array as Arr } from "effect";

/** The cloud over one place under the storms its weather winds up. */
function coverAt(latitude: number, longitude: number, seed: number) {
  return cloudCover(latitude, longitude, seed, stormsOf(seed));
}

/** The mean cover around one circle of latitude, in degrees. */
function meanAt(degrees: number) {
  const latitude = (degrees * Math.PI) / 180;
  const samples = Arr.makeBy(180, (step) =>
    coverAt(latitude, (step / 180) * 2 * Math.PI, 7)
  );
  return Arr.reduce(samples, 0, (sum, cover) => sum + cover) / samples.length;
}

describe("cloudCover", () => {
  it("answers the same cover for the same place and seed, within 0 and 1", () => {
    const covers = Arr.makeBy(400, (step) =>
      coverAt(Math.sin(step) * 1.5, step * 0.37, 3)
    );

    expect(Math.min(...covers)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...covers)).toBeLessThanOrEqual(1);
    expect(coverAt(0.4, 1.3, 3)).toBe(coverAt(0.4, 1.3, 3));
    expect(coverAt(0.4, 1.3, 3)).not.toBe(coverAt(0.4, 1.3, 4));
  });

  it("has no seam where east meets west", () => {
    expect(coverAt(0.3, 0, 5)).toBeCloseTo(coverAt(0.3, 2 * Math.PI, 5));
    expect(coverAt(-0.9, -Math.PI, 5)).toBeCloseTo(coverAt(-0.9, Math.PI, 5));
  });

  it("clears the subtropics and clouds the storm tracks and the equator", () => {
    expect(meanAt(52)).toBeGreaterThan(meanAt(24) + 0.15);
    expect(meanAt(-52)).toBeGreaterThan(meanAt(-24) + 0.15);
    expect(meanAt(0)).toBeGreaterThan(meanAt(24) + 0.1);
  });
});

describe("cloudCover, across the globe", () => {
  it("changes smoothly from place to place, with clear air and full decks both present", () => {
    const row = Arr.makeBy(720, (step) =>
      coverAt(0.7, (step / 720) * 2 * Math.PI, 7)
    );
    const steps = Arr.makeBy(719, (step) =>
      Math.abs(Number(row[step + 1]) - Number(row[step]))
    );
    const everywhere = Arr.makeBy(2000, (step) =>
      coverAt(Math.asin(((step * 0.618) % 1) * 2 - 1), step * 2.4, 7)
    );
    const clear = Arr.filter(everywhere, (cover) => cover < 0.3).length;
    const thick = Arr.filter(everywhere, (cover) => cover > 0.7).length;

    expect(Math.max(...steps)).toBeLessThan(0.08);
    expect(clear).toBeGreaterThan(200);
    expect(thick).toBeGreaterThan(100);
  });
});

describe("stormsOf", () => {
  it("winds up storms in the middle latitudes of both hemispheres, each turning its own way", () => {
    const storms = stormsOf(7);

    expect(storms).toHaveLength(6);
    expect(
      Arr.every(
        storms,
        (storm) =>
          Math.abs(storm.latitude) > 0.62 &&
          Math.abs(storm.latitude) < 1.02 &&
          storm.sense === Math.sign(storm.latitude)
      )
    ).toBe(true);
  });
});

describe("stormAt", () => {
  const storm = { latitude: 0.8, longitude: 1, sense: 1 };

  it("is densest in the middle and gone beyond its reach", () => {
    expect(stormAt(0.8, 1, storm)).toBeCloseTo(0.3);
    expect(stormAt(0.8, 1.9, storm)).toBe(0);
    expect(stormAt(-0.8, 1, storm)).toBe(0);
  });

  it("winds arms round the middle: cloud and gaps alternate along a ring", () => {
    const ring = Arr.makeBy(72, (step) => {
      const angle = (step / 72) * 2 * Math.PI;
      return stormAt(
        0.8 + 0.15 * Math.cos(angle),
        1 + (0.15 * Math.sin(angle)) / Math.cos(0.8),
        storm
      );
    });

    expect(Math.max(...ring) - Math.min(...ring)).toBeGreaterThan(0.1);
  });
});

describe("paintClouds", () => {
  it("paints one byte per pixel from the south pole up and from west to east", () => {
    const pixels = paintClouds(8, 4, 7);

    expect(pixels).toHaveLength(32);
    expect(pixels[0]).toBe(
      Math.round(coverAt(-0.375 * Math.PI, Math.PI / 8, 7) * 255)
    );
    expect(pixels[3 * 8 + 5]).toBe(
      Math.round(coverAt(0.375 * Math.PI, (5.5 / 8) * 2 * Math.PI, 7) * 255)
    );
  });
});

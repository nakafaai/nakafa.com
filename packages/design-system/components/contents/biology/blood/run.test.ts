// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BLOOD_RELEASES,
  clumpingAt,
  FINISH,
  fallen,
  fallTime,
  LOOP,
  mixAt,
  READING,
  readingAt,
  routeAt,
  SERUM_RELEASES,
  STEPS,
  spreadAt,
} from "@repo/design-system/components/contents/biology/blood/run";

describe("the run of a tile test", () => {
  it("puts serum in every cavity before blood, and blood before any stirring", () => {
    expect(SERUM_RELEASES[0]).toBeCloseTo(1.25, 12);
    expect(SERUM_RELEASES[2]).toBeCloseTo(3.85, 12);
    expect(BLOOD_RELEASES[0]).toBeCloseTo(5.6, 12);
    expect(BLOOD_RELEASES[2]).toBeCloseTo(7.2, 12);
    expect(Math.max(...SERUM_RELEASES)).toBeLessThan(STEPS.pipette[0]);
    expect(Math.max(...BLOOD_RELEASES)).toBeLessThan(STEPS.stirrers[0][1]);
  });

  it("moves a tool along its route, resting before and after", () => {
    const keys = [1, 2, 4];
    expect(routeAt(0, keys)).toBe(0);
    expect(routeAt(1.5, keys)).toBeCloseTo(0.5, 12);
    expect(routeAt(2, keys)).toBe(1);
    expect(routeAt(2.5, keys)).toBeCloseTo(1 + 0.156_25, 12);
    expect(routeAt(9, keys)).toBe(2);
  });

  it("drops a drop by free fall", () => {
    expect(fallen(fallTime(0.02))).toBeCloseTo(0.02, 12);
    expect(fallTime(0.02)).toBeCloseTo(0.0639, 4);
  });

  it("spreads a landed drop within a tenth of a second", () => {
    expect(spreadAt(1, 2)).toBe(0);
    expect(spreadAt(2, 2)).toBe(0);
    expect(spreadAt(2.1, 2)).toBeGreaterThan(0.96);
  });

  it("mixes each cavity while its stick stirs", () => {
    expect(mixAt(8, 0)).toBe(0);
    expect(mixAt(9.4, 0)).toBeCloseTo(0.5, 12);
    expect(mixAt(13, 1)).toBe(1);
    expect(mixAt(12.4, 2)).toBeCloseTo(0.5, 12);
  });

  it("clumps the cells only after mixing, nearly completely by the reading", () => {
    expect(clumpingAt(9, 0)).toBe(0);
    expect(clumpingAt(12, 0)).toBeCloseTo(1 - Math.exp(-2 / 12), 12);
    expect(clumpingAt(15.7, 0)).toBeCloseTo(
      1 - Math.exp(-(3.7 + 2 * 6) / 12),
      12
    );
    expect(clumpingAt(FINISH, 2)).toBeCloseTo(1 - Math.exp(-5), 12);
    expect(clumpingAt(FINISH, 0)).toBeGreaterThan(clumpingAt(FINISH, 2));
  });

  it("reads the tile one minute after the last cavity is mixed", () => {
    expect(readingAt(12)).toBe(0);
    expect(readingAt(13.7)).toBeCloseTo(0.7, 12);
    expect(readingAt(FINISH)).toBeCloseTo(READING, 12);
    expect(readingAt(LOOP)).toBe(READING);
    expect(FINISH).toBeCloseTo(13.7 + 59.3 / 6, 12);
    expect(LOOP - FINISH).toBe(4);
  });
});

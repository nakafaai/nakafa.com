import { describe, expect, it } from "@effect/vitest";
import { breadthAt } from "@repo/design-system/components/three/vehicle/lines";
import type { HullLines } from "@repo/design-system/components/three/vessel/hull";
import { halfAt } from "@repo/design-system/components/three/vessel/hull";

const LINES: HullLines = {
  beam: 1.6,
  bow: 0.5,
  depth: 0.6,
  forefoot: 0.3,
  length: 4.3,
  rake: 0.4,
  run: 0.1,
  sheer: 0.2,
  square: 3,
  transom: 0.85,
};

describe("breadthAt", () => {
  it("is the deck's breadth at the deck and above it, and narrower below", () => {
    expect(breadthAt(LINES, 0, 0.6)).toBeCloseTo(halfAt(LINES, 0), 9);
    expect(breadthAt(LINES, 0, 2)).toBeCloseTo(halfAt(LINES, 0), 9);
    expect(breadthAt(LINES, 0, 0.1)).toBeLessThan(halfAt(LINES, 0));
    expect(breadthAt(LINES, 0, 0.1)).toBeGreaterThan(0.4);
  });

  it("is nothing at the keel and under the rising forefoot", () => {
    expect(breadthAt(LINES, 0, 0)).toBe(0);
    expect(breadthAt(LINES, 2.1, 0.05)).toBe(0);
  });
});

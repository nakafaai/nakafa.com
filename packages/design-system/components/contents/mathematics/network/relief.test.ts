// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { Segment } from "@repo/design-system/components/contents/mathematics/network/relief";
import {
  PEAK,
  reliefAt,
} from "@repo/design-system/components/contents/mathematics/network/relief";

const spots = [
  { x: -0.2, z: 0 },
  { x: 0.2, z: 0 },
];
const segments: readonly Segment[] = [[spots[0], spots[1]]];

describe("the relief map's land", () => {
  it("lies flat along a road and round a town", () => {
    expect(reliefAt({ x: 0, z: 0 }, spots, segments)).toBe(0);
    expect(reliefAt({ x: 0, z: 0.015 }, spots, segments)).toBe(0);
    expect(reliefAt({ x: -0.21, z: 0.01 }, spots, segments)).toBe(0);
  });

  it("rises into hills away from every road, never above the peak", () => {
    const far = reliefAt({ x: 0, z: 0.25 }, spots, segments);
    expect(far).toBeGreaterThan(0.004);
    expect(far).toBeLessThanOrEqual(PEAK);
    expect(reliefAt({ x: 0, z: 0.06 }, spots, segments)).toBeLessThan(far);
  });

  it("raises open land everywhere when no town or road pins it down", () => {
    expect(reliefAt({ x: 0.1, z: 0.1 }, [], [])).toBeGreaterThan(0.004);
    expect(reliefAt({ x: 0.1, z: 0.1 }, [], [])).toBe(
      reliefAt({ x: 0.1, z: 0.1 }, [], [])
    );
  });
});

// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  leafHalfWidth,
  leafSurface,
} from "@repo/design-system/components/contents/biology/leaf";
import { Array as Arr } from "effect";

describe("leaf blade", () => {
  it("closes at the base and the tip and is widest below the middle", () => {
    expect(leafHalfWidth(0)).toBe(0);
    expect(leafHalfWidth(1)).toBeCloseTo(0, 6);
    expect(leafHalfWidth(0.4)).toBeGreaterThan(leafHalfWidth(0.6));
  });

  it("samples a grid of points and two triangles per cell", () => {
    const surface = leafSurface({
      columns: 4,
      droop: 0.01,
      length: 0.1,
      rows: 8,
      width: 0.04,
    });

    expect(surface.positions).toHaveLength(9 * 5 * 3);
    expect(surface.indices).toHaveLength(8 * 4 * 6);
    const [x, y] = Arr.takeRight(surface.positions, 3);

    expect(x).toBeCloseTo(0.1, 12);
    expect(y).toBeCloseTo(-0.01, 6);
  });
});

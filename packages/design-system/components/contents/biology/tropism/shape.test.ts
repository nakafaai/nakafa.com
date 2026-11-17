// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  organPath,
  tipHeading,
} from "@repo/design-system/components/contents/biology/tropism/shape";

describe("organ shape", () => {
  it("grows straight along its heading without a bend", () => {
    const path = organPath({
      bend: 0,
      heading: Math.PI / 2,
      length: 2,
      samples: 4,
      straight: 0.5,
    });

    expect(path).toHaveLength(5);
    expect(path[4]?.[0]).toBeCloseTo(0, 12);
    expect(path[4]?.[1]).toBeCloseTo(2, 12);
  });

  it("curves its upper part through the bend and keeps its length", () => {
    const path = organPath({
      bend: Math.PI / 2,
      heading: Math.PI / 2,
      length: 2,
      samples: 200,
      straight: 0.5,
    });
    const tip = path[200];
    const radius = 1 / (Math.PI / 2);

    expect(tip?.[0]).toBeCloseTo(-radius, 6);
    expect(tip?.[1]).toBeCloseTo(1 + radius, 6);
    expect(tipHeading(Math.PI / 2, Math.PI / 2)).toBe(Math.PI);
  });
});

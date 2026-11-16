// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BEANS,
  myceliumOf,
  rhizoidsOf,
  surfaceAt,
  TRAY,
} from "@repo/design-system/components/contents/biology/mould/mycelium";
import { Array as Arr } from "effect";

describe("Rhizopus mycelium", () => {
  it("raises each bean's dome above the tray", () => {
    const [bean] = BEANS;

    expect(surfaceAt(bean.x, bean.z)).toBeCloseTo(TRAY + bean.height, 12);
    expect(surfaceAt(5, 5)).toBe(TRAY);
  });

  it("branches hyphae that never sink into a bean", () => {
    const mycelium = myceliumOf(4, 2, 3);

    expect(mycelium.length).toBeGreaterThan(4);
    expect(
      Arr.every(mycelium, ({ points }) =>
        Arr.every(points, ([x, y, z]) => y >= surfaceAt(x, z))
      )
    ).toBe(true);
    expect(
      Arr.every(mycelium, ({ radius }) => radius > 0 && radius <= 0.0055)
    ).toBe(true);
  });

  it("splays rhizoids out and down from the foot", () => {
    const tuft = rhizoidsOf([0, 0, 0], 5, 2);

    expect(tuft).toHaveLength(5);
    expect(
      Arr.every(tuft, ([foot, , tip]) => (tip?.[1] ?? 0) < (foot?.[1] ?? 0))
    ).toBe(true);
  });
});

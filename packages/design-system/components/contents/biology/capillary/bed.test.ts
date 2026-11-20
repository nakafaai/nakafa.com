// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  ARTERIOLE,
  arterioleRadius,
  CAPILLARIES,
  CAPILLARY,
  curve,
  inner,
  LYMPH,
  outer,
  VENULE,
  venuleRadius,
} from "@repo/design-system/components/contents/biology/capillary/bed";
import { Array as Arr } from "effect";

describe("the vessels", () => {
  it("draws every width to scale in units of 10 micrometres", () => {
    expect(outer(CAPILLARY)).toBeCloseTo(0.35, 12);
    expect(inner(CAPILLARY)).toBeCloseTo(0.3, 12);
    expect(inner(ARTERIOLE) / (ARTERIOLE.wall / 10)).toBeCloseTo(0.75, 12);
    expect(VENULE.lumen / VENULE.wall).toBe(10);
    expect(outer(LYMPH)).toBeCloseTo(2.55, 12);
  });

  it("narrows the arteriole and widens the venule between a capillary's width and their own", () => {
    expect(arterioleRadius(0)).toBe(outer(ARTERIOLE));
    expect(arterioleRadius(1)).toBeCloseTo(outer(CAPILLARY), 12);
    expect(venuleRadius(0)).toBeCloseTo(outer(CAPILLARY), 12);
    expect(venuleRadius(1)).toBeCloseTo(outer(VENULE), 12);
  });

  it("keeps each capillary resting on the tissue floor", () => {
    Arr.forEach(CAPILLARIES, (capillary) => {
      const line = curve(capillary.path);
      Arr.forEach(Arr.range(0, 20), (step) => {
        expect(line.getPointAt(step / 20).y).toBeCloseTo(outer(CAPILLARY), 6);
      });
    });
  });
});

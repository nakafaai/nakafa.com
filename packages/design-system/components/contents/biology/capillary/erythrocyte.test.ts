// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  CAPILLARY,
  inner,
} from "@repo/design-system/components/contents/biology/capillary/bed";
import {
  ERYTHROCYTE,
  erythrocyteOutline,
  erythrocyteThickness,
} from "@repo/design-system/components/contents/biology/capillary/erythrocyte";
import { Array as Arr } from "effect";

/** The volume of a red cell, in cubic micrometres, summed in thin rings. */
function erythrocyteVolume(rings: number) {
  const width = ERYTHROCYTE.radius / rings;
  return Arr.reduce(Arr.range(0, rings - 1), 0, (volume, ring) => {
    const r = (ring + 0.5) * width;
    return volume + 2 * Math.PI * r * width * erythrocyteThickness(r);
  });
}

describe("the red cell", () => {
  it("is a disc 7.82 micrometres across, 0.81 thick at the centre and about 2.57 at the rim", () => {
    expect(2 * ERYTHROCYTE.radius).toBeCloseTo(7.82, 12);
    expect(erythrocyteThickness(0)).toBe(0.81);
    const rim = Arr.reduce(Arr.range(0, 400), 0, (most, step) =>
      Math.max(most, erythrocyteThickness((step / 400) * ERYTHROCYTE.radius))
    );
    expect(rim).toBeCloseTo(2.57, 2);
    expect(erythrocyteThickness(ERYTHROCYTE.radius)).toBe(0);
    expect(erythrocyteThickness(5)).toBe(0);
  });

  it("holds about 94 cubic micrometres, as Evans and Fung measured", () => {
    expect(erythrocyteVolume(2000)).toBeCloseTo(94, 0);
  });

  it("outlines both faces of the disc, and folds into a parachute to fit a capillary", () => {
    const disc = erythrocyteOutline(8);
    expect(disc).toHaveLength(18);
    expect(disc[0]).toEqual([0, -0.405]);
    expect(disc[17]).toEqual([0, 0.405]);
    const fit = inner(CAPILLARY) * 10 - 0.3;
    const parachute = erythrocyteOutline(8, fit);
    const widest = Arr.reduce(parachute, 0, (most, [r]) => Math.max(most, r));
    expect(widest).toBeCloseTo(fit, 12);
    expect(parachute[8]?.[1]).toBeLessThan(-2);
    expect(erythrocyteOutline(8, 5)).toEqual(disc);
  });
});

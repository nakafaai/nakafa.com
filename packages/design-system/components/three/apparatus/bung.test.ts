// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  bungOf,
  DELIVERY,
  deliveryOf,
} from "@repo/design-system/components/three/apparatus/bung";
import { Array as Arr } from "effect";

describe("a bung in a neck", () => {
  const bore = 0.0148;
  const outline = bungOf(bore);

  it("is narrower than the neck below the rim and wider above it", () => {
    const below = Arr.filter(outline, ([, height]) => height < -0.005);
    const above = Arr.filter(outline, ([, height]) => height > 0.005);
    expect(Arr.every(below, ([radius]) => radius < bore)).toBe(true);
    expect(Arr.some(above, ([radius]) => radius > bore)).toBe(true);
  });

  it("is bored for the delivery tube at both faces", () => {
    expect(outline[0][0]).toBe(DELIVERY.tube);
    expect(outline[5][0]).toBe(DELIVERY.tube);
  });
});

describe("a delivery tube", () => {
  it("rises from under the bung and ends at the reach and the rise", () => {
    const { route } = deliveryOf(0.18, 0.2);
    expect(route).toMatchObject({
      kind: "route",
      points: [
        [0, -0.026, 0],
        [0, 0.2, 0],
        [0.18, 0.2, 0],
      ],
    });
  });

  it("lays its sleeve along the tube over its end, whichever way it runs", () => {
    expect(deliveryOf(0.1, 0.2).sleeve).toEqual([
      [0.088, 0.2, 0],
      [0.112, 0.2, 0],
    ]);
    expect(deliveryOf(-0.1, 0.2).sleeve).toEqual([
      [-0.088, 0.2, 0],
      [-0.112, 0.2, 0],
    ]);
  });
});

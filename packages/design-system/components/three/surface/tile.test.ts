import { describe, expect, it } from "@effect/vitest";
import {
  fromStripe,
  held,
} from "@repo/design-system/components/three/surface/tile";

describe("held", () => {
  it("keeps a number between 0 and 1", () => {
    expect(held(-0.4)).toBe(0);
    expect(held(0.4)).toBe(0.4);
    expect(held(1.4)).toBe(1);
  });
});

describe("fromStripe", () => {
  it("is 0 in the middle of a stripe and 1 at its edges", () => {
    expect(fromStripe(0.125, 4)).toBe(0);
    expect(fromStripe(0.25, 4)).toBe(1);
    expect(fromStripe(0.1875, 4)).toBeCloseTo(0.5, 9);
  });

  it("repeats in every stripe", () => {
    expect(fromStripe(0.3, 4)).toBeCloseTo(fromStripe(0.55, 4), 9);
  });
});

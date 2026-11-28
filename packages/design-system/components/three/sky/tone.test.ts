import { describe, expect, it } from "@effect/vitest";
import { filmed } from "@repo/design-system/components/three/sky/tone";

describe("filmed", () => {
  it("keeps black black and rolls a lit white surface off below paper white", () => {
    expect(filmed([0, 0, 0])).toEqual([0, 0, 0]);

    const [red, green, blue] = filmed([1, 1, 1]);

    expect(red).toBeCloseTo(0.763, 2);
    expect(green).toBeCloseTo(0.763, 2);
    expect(blue).toBeCloseTo(0.763, 2);
  });

  it("holds light far brighter than the display at the display's white", () => {
    expect(filmed([400, 400, 400])).toEqual([1, 1, 1]);
  });

  it("keeps a pale blue haze pale and blue", () => {
    const [red, green, blue] = filmed([0.46, 0.66, 0.82]);

    expect(blue).toBeGreaterThan(green);
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(0.4);
    expect(blue).toBeLessThan(0.9);
  });
});

// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { blendLab, greyedLab, labOf, rgbOfLab } from "@/lib/island/oklab";

describe("island/oklab", () => {
  it("reads white, black and a color back as they were", () => {
    expect(labOf([1, 1, 1])[0]).toBeCloseTo(1, 4);
    expect(labOf([0, 0, 0])[0]).toBeCloseTo(0, 6);
    const back = rgbOfLab(labOf([0.95, 0.53, 0.35]));
    expect(back[0]).toBeCloseTo(0.95, 4);
    expect(back[1]).toBeCloseTo(0.53, 4);
    expect(back[2]).toBeCloseTo(0.35, 4);
  });

  it("blends day blue into dusk orange through a color, not through grey", () => {
    const blue = [0.34, 0.65, 0.89] as const;
    const orange = [0.95, 0.53, 0.35] as const;
    expect(blendLab(blue, orange, 0)).toEqual(rgbOfLab(labOf(blue)));
    const middle = blendLab(blue, orange, 0.5);
    const plain = [0.645, 0.59, 0.62];
    const colorfulness = (color: readonly number[]) =>
      Math.max(...color) - Math.min(...color);
    expect(colorfulness(middle)).toBeGreaterThan(colorfulness(plain));
  });

  it("greys a color without changing how light it looks, and keeps every channel on the screen", () => {
    const red = [0.9, 0.2, 0.15] as const;
    const grey = greyedLab(red, 1);
    expect(labOf(grey)[0]).toBeCloseTo(labOf(red)[0], 3);
    expect(Math.max(...grey) - Math.min(...grey)).toBeLessThan(0.01);
    const bright = rgbOfLab([1.2, 0.3, -0.3]);
    expect(Math.max(...bright)).toBeLessThanOrEqual(1);
    expect(Math.min(...bright)).toBeGreaterThanOrEqual(0);
  });
});

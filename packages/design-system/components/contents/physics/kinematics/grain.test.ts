import { describe, expect, it } from "@effect/vitest";
import { grainTexture } from "@repo/design-system/components/contents/physics/kinematics/grain";
import { Array as Arr } from "effect";
import { RepeatWrapping } from "three";

describe("grainTexture", () => {
  it("is an opaque grey tile that repeats both ways", () => {
    const texture = grainTexture(0.5);
    const pixels = Arr.fromIterable(texture.image.data ?? []);
    expect(texture.image.width).toBe(256);
    expect(pixels.length).toBe(256 * 256 * 4);
    expect(pixels[0]).toBe(pixels[1]);
    expect(pixels[3]).toBe(255);
    expect(texture.wrapS).toBe(RepeatWrapping);
    expect(texture.wrapT).toBe(RepeatWrapping);
  });

  it("strays further from its mean brightness the more contrast it is given", () => {
    const spread = (contrast: number) => {
      const reds = Arr.filter(
        Arr.fromIterable(grainTexture(contrast).image.data ?? []),
        (_, index) => index % 4 === 0
      );
      return Math.max(...reds) - Math.min(...reds);
    };
    expect(spread(0)).toBe(0);
    expect(spread(1.5)).toBeGreaterThan(spread(0.4));
    expect(spread(40)).toBe(255);
  });
});

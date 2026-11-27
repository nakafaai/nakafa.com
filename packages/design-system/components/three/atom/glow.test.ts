import { describe, expect, it } from "@effect/vitest";
import { paintGlow } from "@repo/design-system/components/three/atom/glow";

describe("paintGlow", () => {
  it("is white, brightest at the middle and clear at every edge", () => {
    const size = 33;
    const pixels = paintGlow(size);
    const alpha = (column: number, row: number) =>
      Number(pixels[(row * size + column) * 4 + 3]);
    expect(pixels).toHaveLength(size * size * 4);
    expect(pixels[0]).toBe(255);
    expect(alpha(16, 16)).toBe(255);
    expect(alpha(20, 16)).toBeLessThan(alpha(18, 16));
    expect(alpha(26, 16)).toBeLessThan(alpha(20, 16));
    expect(alpha(26, 16)).toBeGreaterThan(0);
    expect(alpha(0, 16)).toBe(0);
    expect(alpha(16, 32)).toBe(0);
    expect(alpha(0, 0)).toBe(0);
  });
});

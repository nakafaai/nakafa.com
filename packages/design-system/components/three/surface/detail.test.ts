import { describe, expect, it } from "@effect/vitest";
import {
  paintDetail,
  SurfaceSchema,
} from "@repo/design-system/components/three/surface/detail";
import { Array as Arr } from "effect";

describe("paintDetail", () => {
  it.each(SurfaceSchema.literals)(
    "paints %s as opaque tone, roughness and relief tiles",
    (surface) => {
      const { height, roughness, tone } = paintDetail(surface, 16);

      expect(tone).toHaveLength(16 * 16 * 4);
      expect(roughness).toHaveLength(16 * 16 * 4);
      expect(height).toHaveLength(16 * 16 * 4);
      expect(
        Arr.every(
          Arr.makeBy(16 * 16, (pixel) => tone[pixel * 4 + 3]),
          (alpha) => alpha === 255
        )
      ).toBe(true);
    }
  );

  it("varies a surface across its tile instead of painting one flat tone", () => {
    const { tone } = paintDetail("wood", 32);
    const shades = Arr.dedupe(Arr.makeBy(32 * 32, (pixel) => tone[pixel * 4]));

    expect(shades.length).toBeGreaterThan(20);
  });

  it("keeps rubber rougher than brushed metal", () => {
    const mean = (surface: "brushed" | "rubber") => {
      const { roughness } = paintDetail(surface, 16);
      return (
        Arr.reduce(
          Arr.makeBy(16 * 16, (pixel) => roughness[pixel * 4 + 1] ?? 0),
          0,
          (sum, value) => sum + value
        ) / 256
      );
    };

    expect(mean("rubber")).toBeGreaterThan(mean("brushed") + 80);
  });
});

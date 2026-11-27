import { describe, expect, it } from "@effect/vitest";
import type { Rgb } from "@repo/design-system/components/three/label/ink";
import {
  contrastRatio,
  LABEL_CONTRAST,
  LABEL_MOVED_CONTRAST,
  readableInk,
  relativeLuminance,
} from "@repo/design-system/components/three/label/ink";

const WHITE_CARD: Rgb = [255, 255, 255];
/** The dark theme's `--card`, oklch(0.13706 0.03597 258.53), in sRGB. */
const DARK_CARD: Rgb = [2, 8, 23];
const REACTANT_BLUE: Rgb = [61, 126, 196];
const PRODUCT_ORANGE: Rgb = [217, 119, 36];
const LABEL_INK: Rgb = [34, 37, 42];

/** The hue of a color in degrees, to show an ink keeps its identity. */
function hue([red, green, blue]: Rgb) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  if (max === red) {
    return (60 * (((green - blue) / delta) % 6) + 360) % 360;
  }
  if (max === green) {
    return 60 * ((blue - red) / delta + 2);
  }
  return 60 * ((red - green) / delta + 4);
}

describe("relativeLuminance", () => {
  it("runs from black to white through both curve segments", () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 10);
    expect(relativeLuminance([5, 5, 5])).toBeCloseTo(5 / 255 / 12.92, 10);
  });
});

describe("contrastRatio", () => {
  it("gives 21 for black on white in either order and 1 for a color on itself", () => {
    expect(contrastRatio([0, 0, 0], WHITE_CARD)).toBeCloseTo(21, 10);
    expect(contrastRatio(WHITE_CARD, [0, 0, 0])).toBeCloseTo(21, 10);
    expect(contrastRatio(REACTANT_BLUE, REACTANT_BLUE)).toBe(1);
  });
});

describe("readableInk", () => {
  it("keeps an ink that already reads", () => {
    expect(readableInk(LABEL_INK, WHITE_CARD)).toBe(LABEL_INK);
  });

  it("deepens a coloured ink on a white card and keeps its hue", () => {
    for (const ink of [REACTANT_BLUE, PRODUCT_ORANGE]) {
      const deeper = readableInk(ink, WHITE_CARD);
      expect(contrastRatio(deeper, WHITE_CARD)).toBeGreaterThanOrEqual(
        LABEL_MOVED_CONTRAST
      );
      expect(Math.abs(hue(deeper) - hue(ink))).toBeLessThan(3);
      expect(relativeLuminance(deeper)).toBeLessThan(relativeLuminance(ink));
    }
  });

  it("turns a fixed dark ink light on a dark card", () => {
    const light = readableInk(LABEL_INK, DARK_CARD);
    expect(contrastRatio(light, DARK_CARD)).toBeGreaterThanOrEqual(
      LABEL_MOVED_CONTRAST
    );
    expect(relativeLuminance(light)).toBeGreaterThan(
      relativeLuminance(LABEL_INK)
    );
  });

  it("moves the least way that reaches the moved contrast", () => {
    const deeper = readableInk(PRODUCT_ORANGE, WHITE_CARD);
    const step: Rgb = [deeper[0] + 2, deeper[1] + 1, deeper[2] + 1];
    expect(contrastRatio(step, WHITE_CARD)).toBeLessThan(LABEL_MOVED_CONTRAST);
    expect(contrastRatio(REACTANT_BLUE, DARK_CARD)).toBeGreaterThanOrEqual(
      LABEL_CONTRAST
    );
    expect(readableInk(REACTANT_BLUE, DARK_CARD)).toBe(REACTANT_BLUE);
  });
});

// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  hoopCentres,
  MAT,
} from "@repo/design-system/components/contents/mathematics/venn/layout";
import {
  TINT_DEPTH,
  TINT_WIDTH,
  tintImage,
} from "@repo/design-system/components/contents/mathematics/venn/tint";
import { Array as Arr } from "effect";

/** The opacity of the pixel under a place on the mat. */
function opacityAt(image: Uint8ClampedArray, x: number, z: number) {
  const column = Math.floor((x / MAT.width + 0.5) * TINT_WIDTH);
  const row = Math.floor((0.5 - z / MAT.depth) * TINT_DEPTH);
  return image[(row * TINT_WIDTH + column) * 4 + 1];
}

describe("the tint of a region", () => {
  it("covers the region the operation selects and nothing else", () => {
    const centres = hoopCentres(2);
    const both = tintImage("intersection", centres);
    expect(both).toHaveLength(TINT_WIDTH * TINT_DEPTH * 4);
    expect(opacityAt(both, 0, 0)).toBe(255);
    expect(opacityAt(both, -0.5, 0)).toBe(0);
    const outside = tintImage("outside-union", centres);
    expect(opacityAt(outside, 0, 0.6)).toBe(255);
    expect(opacityAt(outside, 0, 0)).toBe(0);
  });

  it("puts the mat's front edge on the image's first row", () => {
    const centres = hoopCentres(3);
    const front = tintImage("complement", centres);
    expect(opacityAt(front, 0.8, 0.65)).toBe(255);
    expect(front[1]).toBe(255);
    expect(front[3]).toBe(255);
  });

  it("softens the pixels a hoop's edge crosses", () => {
    const image = tintImage("union", hoopCentres(2));
    const partial = Arr.filter(
      Arr.makeBy(TINT_WIDTH * TINT_DEPTH, (pixel) => image[pixel * 4 + 1]),
      (opacity) => opacity !== undefined && opacity > 0 && opacity < 255
    );
    expect(partial.length).toBeGreaterThan(0);
  });
});

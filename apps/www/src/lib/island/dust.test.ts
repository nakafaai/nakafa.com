// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { atlasPixels } from "@/lib/island/atlas";
import { dustOf } from "@/lib/island/dust";

const pixels = atlasPixels();

describe("island/dust", () => {
  it("colors a block's chips from its own side tile", () => {
    const [r, g, b] = dustOf(pixels, idOf("grass"));
    // Grass's side is soil under a green fringe: warm, more red and green than blue.
    expect(r).toBeGreaterThan(b);
    const brick = dustOf(pixels, idOf("brick"));
    expect(brick[0]).toBeGreaterThan(brick[2] + 0.15);
    const stone = dustOf(pixels, idOf("stone"));
    expect(Math.abs(stone[0] - stone[2])).toBeLessThan(0.12);
    for (const channel of [r, g, b]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });

  it("falls back to a pale dust for a tile with no opaque pixel", () => {
    expect(dustOf(new Uint8ClampedArray(pixels.length), idOf("brick"))).toEqual(
      [0.8, 0.78, 0.72]
    );
  });
});

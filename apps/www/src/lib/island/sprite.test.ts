import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { DUCK, FISH, NINA_PEEK } from "@/lib/island/animals";
import { paletteBytes, paletteIndex } from "@/lib/island/palette";
import { packAtlas } from "@/lib/island/sprite";

describe("island sprites", () => {
  it("packs every frame side by side with a clear texel between frames", () => {
    const atlas = packAtlas({ duck: DUCK, fish: FISH });
    expect(atlas.frames.duck).toEqual([
      { height: 8, width: 10, x: 0, y: 0 },
      { height: 8, width: 10, x: 11, y: 0 },
    ]);
    expect(atlas.frames.fish).toEqual([
      { height: 3, width: 7, x: 22, y: 0 },
      { height: 3, width: 7, x: 30, y: 0 },
    ]);
    expect([atlas.width, atlas.height]).toEqual([38, 8]);
    expect(atlas.pixels).toHaveLength(38 * 8 * 4);
  });

  it("paints a pixel its palette colour with its index plus one in alpha, and leaves clear pixels empty", () => {
    const atlas = packAtlas({ fish: FISH });
    const palette = paletteBytes();
    const orange = paletteIndex("fur", 2);
    expect(Arr.fromIterable(atlas.pixels.subarray(0, 4))).toEqual([
      ...palette.subarray(orange * 4, orange * 4 + 3),
      orange + 1,
    ]);
    expect(Arr.fromIterable(atlas.pixels.subarray(4, 8))).toEqual([0, 0, 0, 0]);
  });

  it("gives every animal frames of one size, each written in its key", () => {
    for (const sprite of [DUCK, FISH, NINA_PEEK]) {
      const [first] = sprite.frames;
      for (const frame of sprite.frames) {
        expect(frame.length).toBe(first?.length);
        for (const row of frame) {
          for (const glyph of row) {
            expect(glyph === "." || glyph in sprite.key).toBe(true);
          }
        }
      }
    }
  });
});

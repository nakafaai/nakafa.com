import { describe, expect, it } from "@effect/vitest";
import { NearestFilter } from "three";
import { PALETTE_SIZE, paletteBytes } from "@/lib/island/palette";
import { paletteTexture, pixelTexture } from "@/lib/island/texture";

describe("island textures", () => {
  it("samples pixels texel by texel and uploads them on first use", () => {
    const pixels = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const texture = pixelTexture(pixels, 2, 1);
    expect(texture.image).toMatchObject({ data: pixels, height: 1, width: 2 });
    expect(texture.magFilter).toBe(NearestFilter);
    expect(texture.minFilter).toBe(NearestFilter);
    expect(texture.version).toBeGreaterThan(0);
  });

  it("lays the palette out as one row of one texel a colour", () => {
    const texture = paletteTexture();
    expect(texture.image).toMatchObject({ height: 1, width: PALETTE_SIZE });
    expect(texture.image.data).toEqual(paletteBytes());
  });
});

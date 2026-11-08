import { DataTexture, NearestFilter, RGBAFormat } from "three";
import { PALETTE_SIZE, paletteBytes } from "@/lib/island/palette";

/**
 * RGBA pixels as a texture the island's shaders read texel by texel: nearest
 * sampling, so a texel is never blended with its neighbour.
 */
export function pixelTexture(
  pixels: Uint8Array,
  width: number,
  height: number
) {
  const texture = new DataTexture(pixels, width, height, RGBAFormat);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

/** The palette as a texture of one row, one texel a colour, read by its index. */
export function paletteTexture() {
  return pixelTexture(paletteBytes(), PALETTE_SIZE, 1);
}

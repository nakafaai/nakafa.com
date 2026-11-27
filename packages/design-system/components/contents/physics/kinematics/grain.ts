import { grainField } from "@repo/design-system/components/contents/simulation/grain";
import { DataTexture, RepeatWrapping } from "three";

/** Grain texels along each side of the tile. */
const SIZE = 256;

/**
 * A tile of fine grain as a texture that repeats: a brightness that varies
 * around one, so a material that wears it keeps its own colour as the mean
 * colour of the road or the leaves it covers. The caller owns the texture
 * and disposes it.
 *
 * @param contrast - How far the brightness strays from its mean
 */
export function grainTexture(contrast: number) {
  const field = grainField(SIZE);
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let index = 0; index < field.length; index += 1) {
    const value = 1 + (field[index] - 0.5) * contrast;
    const byte = Math.max(0, Math.min(255, Math.round(value * 200)));
    data[index * 4] = byte;
    data[index * 4 + 1] = byte;
    data[index * 4 + 2] = byte;
    data[index * 4 + 3] = 255;
  }
  const texture = new DataTexture(data, SIZE, SIZE);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The soft light of a glowing point as a square tile of `size` pixels, four
 * numbers from 0 to 255 for each pixel: white everywhere, with an opacity
 * that is full at the middle, falls away as a hot core inside a wide, faint
 * halo, and reaches nothing at the tile's edge, so a point drawn with it
 * has no square outline. It is painted, not loaded, so it is the same on
 * every device.
 */
export function paintGlow(size: number) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const middle = (size - 1) / 2;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const far = Math.min(
        1,
        Math.hypot(column - middle, row - middle) / (size / 2)
      );
      const core = Math.exp(-((far / 0.24) ** 2));
      const halo = Math.exp(-((far / 0.5) ** 2)) * 0.38;
      const edge = (1 - far) ** 2;
      const at = (row * size + column) * 4;
      pixels[at] = 255;
      pixels[at + 1] = 255;
      pixels[at + 2] = 255;
      pixels[at + 3] = Math.min(1, core + halo) * edge * 255;
    }
  }
  return pixels;
}

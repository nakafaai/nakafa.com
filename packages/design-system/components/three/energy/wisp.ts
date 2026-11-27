/**
 * A wisp of smoke as a wind tunnel's smoke rake lays it into the air: a soft
 * thread with no edge, thickest and densest along its middle, thinning to
 * nothing at its sides and at both of its ends.
 */

/**
 * How dense the smoke is at a place on a wisp, from 0 for clear air to 1:
 * `along` runs from its tail to its head and `across` from one side to the
 * other, both from 0 to 1.
 */
export function wispDensity(along: number, across: number) {
  return Math.sin(Math.PI * across) ** 2 * Math.sin(Math.PI * along);
}

/**
 * A wisp painted as white pixels whose opacity is the smoke's density, `wide`
 * pixels across the wisp and `long` pixels along it, four bytes a pixel, row
 * by row from the tail. Each pixel takes the density at its middle.
 */
export function wispPixels(wide: number, long: number) {
  return Uint8Array.from({ length: wide * long * 4 }, (_, byte) => {
    if (byte % 4 !== 3) {
      return 255;
    }
    const pixel = (byte - 3) / 4;
    const across = ((pixel % wide) + 0.5) / wide;
    const along = (Math.floor(pixel / wide) + 0.5) / long;
    return Math.round(255 * wispDensity(along, across));
  });
}

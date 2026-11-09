import { unitOf } from "@/lib/island/noise";
import { colorOf, type Ramp, type Tone } from "@/lib/island/palette";

/** The side of a tile in art pixels. */
export const TILE = 16;

/** One tile: 16 by 16 pixels of RGBA, transparent until painted. */
export type Pixels = Uint8ClampedArray;

/** A new, fully transparent tile. */
export function blankTile(): Pixels {
  return new Uint8ClampedArray(TILE * TILE * 4);
}

/** Paints one pixel with a tone of a ramp; a pixel outside the tile wraps around, so patterns tile seamlessly. */
export function put(
  pixels: Pixels,
  x: number,
  y: number,
  ramp: Ramp,
  tone: Tone,
  alpha = 255
) {
  const wrappedX = ((x % TILE) + TILE) % TILE;
  const wrappedY = ((y % TILE) + TILE) % TILE;
  const at = (wrappedY * TILE + wrappedX) * 4;
  const [red, green, blue] = colorOf(ramp, tone);
  pixels[at] = red;
  pixels[at + 1] = green;
  pixels[at + 2] = blue;
  pixels[at + 3] = alpha;
}

/** Whether a pixel has been painted. */
export function isPainted(pixels: Pixels, x: number, y: number) {
  return pixels[(y * TILE + x) * 4 + 3] > 0;
}

/** Paints every pixel with one tone. */
export function flood(pixels: Pixels, ramp: Ramp, tone: Tone, alpha = 255) {
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      put(pixels, x, y, ramp, tone, alpha);
    }
  }
}

/**
 * Scatters tones over a tile: each pixel takes the first tone whose share its
 * seeded roll falls under, so the same seed always draws the same grain.
 */
export function speckle(
  pixels: Pixels,
  seed: number,
  ramp: Ramp,
  shares: readonly (readonly [Tone, number])[]
) {
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      let roll = unitOf(seed, x, y);
      for (const [tone, share] of shares) {
        if (roll < share) {
          put(pixels, x, y, ramp, tone);
          break;
        }
        roll -= share;
      }
    }
  }
}

/**
 * Paints small clumps: at each seeded spot a pixel and the one to its right,
 * with a darker pixel under them, the way light catches a bump.
 */
export function clumps(
  pixels: Pixels,
  seed: number,
  count: number,
  ramp: Ramp,
  light: Tone,
  dark: Tone
) {
  for (let index = 0; index < count; index += 1) {
    const x = Math.floor(unitOf(seed, index, 1) * TILE);
    const y = Math.floor(unitOf(seed, index, 2) * TILE);
    put(pixels, x, y, ramp, light);
    put(pixels, x + 1, y, ramp, light);
    put(pixels, x, y + 1, ramp, dark);
    put(pixels, x + 1, y + 1, ramp, dark);
  }
}

/**
 * The nearest and second-nearest of a few seeded points to each pixel, on a
 * wrapping tile: the cells of stones, leaves and cobbles.
 */
export function cellsOf(seed: number, count: number) {
  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    xs[index] = unitOf(seed, index, 3) * TILE;
    ys[index] = unitOf(seed, index, 4) * TILE;
  }
  return (x: number, y: number) => {
    let nearest = Number.POSITIVE_INFINITY;
    let second = Number.POSITIVE_INFINITY;
    let owner = 0;
    for (let index = 0; index < count; index += 1) {
      const dx = Math.abs(xs[index] - x);
      const dy = Math.abs(ys[index] - y);
      const distance = Math.hypot(
        Math.min(dx, TILE - dx),
        Math.min(dy, TILE - dy)
      );
      if (distance < nearest) {
        second = nearest;
        nearest = distance;
        owner = index;
      } else if (distance < second) {
        second = distance;
      }
    }
    return { edge: second - nearest, owner };
  };
}

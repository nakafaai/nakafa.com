import { Schema } from "effect";

/** What the ground of a lab is made of. */
export const GroundSchema = Schema.Literals([
  "grass",
  "asphalt",
  "sand",
  "snow",
  "soil",
  "concrete",
]);

/** One tone as its red, green and blue, each from 0 to 255. */
const ToneSchema = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);

/**
 * How one ground is painted: its two tones, which broad patches blend between,
 * the tone of its flecks (blades, grit, pebbles, crystals) and how much of it
 * they cover, and how much its fine grain darkens the surface.
 */
const PaintSchema = Schema.Struct({
  dark: ToneSchema,
  fleck: ToneSchema,
  flecks: Schema.Finite,
  light: ToneSchema,
  shade: Schema.Finite,
});

const GROUNDS: Record<typeof GroundSchema.Type, typeof PaintSchema.Type> = {
  asphalt: {
    dark: [98, 100, 106],
    fleck: [168, 170, 174],
    flecks: 0.1,
    light: [128, 130, 136],
    shade: 0.24,
  },
  concrete: {
    dark: [150, 152, 154],
    fleck: [108, 110, 114],
    flecks: 0.06,
    light: [190, 191, 190],
    shade: 0.16,
  },
  grass: {
    dark: [92, 136, 60],
    fleck: [186, 204, 112],
    flecks: 0.2,
    light: [140, 176, 82],
    shade: 0.36,
  },
  sand: {
    dark: [196, 170, 118],
    fleck: [150, 126, 86],
    flecks: 0.07,
    light: [226, 206, 156],
    shade: 0.2,
  },
  snow: {
    dark: [206, 220, 236],
    fleck: [255, 255, 255],
    flecks: 0.12,
    light: [244, 248, 252],
    shade: 0.1,
  },
  soil: {
    dark: [92, 68, 46],
    fleck: [150, 128, 100],
    flecks: 0.08,
    light: [132, 100, 70],
    shade: 0.34,
  },
};

/** A number between 0 and 1 that one lattice point always answers. */
function lattice(x: number, y: number, seed: number) {
  const wave = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43_758.5453;
  return wave - Math.floor(wave);
}

/** Smooth noise at x, y that repeats every `period` lattice points. */
function smooth(x: number, y: number, period: number, seed: number) {
  const left = Math.floor(x);
  const top = Math.floor(y);
  const across = x - left;
  const down = y - top;
  const easeX = across * across * (3 - 2 * across);
  const easeY = down * down * (3 - 2 * down);
  const corner = (dx: number, dy: number) =>
    lattice((left + dx) % period, (top + dy) % period, seed);
  const upper = corner(0, 0) + (corner(1, 0) - corner(0, 0)) * easeX;
  const lower = corner(0, 1) + (corner(1, 1) - corner(0, 1)) * easeX;
  return upper + (lower - upper) * easeY;
}

/**
 * Grain at one place of a square that tiles without a seam, between 0 and 1.
 * `x` and `y` run from 0 to 1 across the square. `coarse` is how many patches
 * cross the square at its broadest; each of the four layers under it is twice
 * as fine and half as strong.
 */
export function grainAt(x: number, y: number, coarse: number, seed: number) {
  let sum = 0;
  let strength = 0.5;
  let period = coarse;
  for (let layer = 0; layer < 4; layer += 1) {
    sum += smooth(x * period, y * period, period, seed + layer) * strength;
    strength /= 2;
    period *= 2;
  }
  return sum / 0.9375;
}

/**
 * Paints one ground as three square images of `size` pixels, four bytes a
 * pixel: its colour, its relief, where a brighter pixel stands higher, and its
 * patches, the broad lighter and darker areas of a real surface. Colour and
 * relief hold only fine grain, so they can repeat as far as the haze without
 * the eye finding the tile; the patches hold everything broad, and are laid
 * over the whole ground only a few times.
 */
export function paintGround(kind: typeof GroundSchema.Type, size: number) {
  const { dark, fleck, flecks, light, shade } = GROUNDS[kind];
  const color = new Uint8ClampedArray(size * size * 4);
  const relief = new Uint8ClampedArray(size * size * 4);
  const patches = new Uint8ClampedArray(size * size * 4);
  for (let pixel = 0; pixel < size * size; pixel += 1) {
    const x = (pixel % size) / size;
    const y = Math.floor(pixel / size) / size;
    const tone = grainAt(x, y, 16, 1);
    const fine = grainAt(x, y, 32, 7);
    const fleckness = Math.min(
      1,
      Math.max(0, grainAt(x, y, 64, 13) - (1 - flecks)) / flecks
    );
    const lit = 1 - shade * (1 - fine);
    const channel = (index: 0 | 1 | 2) => {
      const base = dark[index] + (light[index] - dark[index]) * tone;
      return (base + (fleck[index] - base) * fleckness) * lit;
    };
    const height = (fine * 0.75 + tone * 0.25) * 255;
    const broad = (0.45 + 0.55 * grainAt(x, y, 3, 21)) * 255;
    color.set([channel(0), channel(1), channel(2), 255], pixel * 4);
    relief.set([height, height, height, 255], pixel * 4);
    patches.set([broad, broad, broad, 255], pixel * 4);
  }
  return { color, patches, relief };
}

/**
 * The dashes of a lane line as one row of `size` pixels, four bytes a pixel:
 * white along the first `dash` share of the row and black after it, as an
 * alpha map reads it.
 */
export function paintDashes(size: number, dash: number) {
  const row = new Uint8ClampedArray(size * 4);
  for (let pixel = 0; pixel < size; pixel += 1) {
    const shown = pixel < size * dash ? 255 : 0;
    row.set([shown, shown, shown, 255], pixel * 4);
  }
  return row;
}

/**
 * A soft verge as one row of `size` pixels, four bytes a pixel: black at both
 * ends and white across the middle, as an alpha map reads it, so a strip laid
 * on the ground has no cut edge.
 */
export function paintVerge(size: number, soft: number) {
  const row = new Uint8ClampedArray(size * 4);
  for (let pixel = 0; pixel < size; pixel += 1) {
    const fromEdge = Math.min(pixel, size - 1 - pixel) / (size - 1);
    const near = Math.min(1, fromEdge / soft);
    const shown = near * near * (3 - 2 * near) * 255;
    row.set([shown, shown, shown, 255], pixel * 4);
  }
  return row;
}

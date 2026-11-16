import { grainAt } from "@repo/design-system/components/three/stage/grain";
import { Array as Arr, MutableHashMap, Option } from "effect";
import { DataTexture, LinearMipmapLinearFilter, SRGBColorSpace } from "three";

/** Pixels across one cell of the painted module. */
const CELL = 48;

/** The tones of a monocrystalline module, red, green and blue from 0 to 255. */
const TONES = {
  backsheet: [222, 226, 230],
  busbar: [196, 200, 206],
  cell: [22, 30, 52],
  finger: [36, 44, 66],
} as const;

/** The modules painted so far, one per layout, shared by every lab. */
const PAINTED = MutableHashMap.empty<string, DataTexture>();

/**
 * Whether a place inside one cell, `x` and `y` from 0 to 1, is cell rather
 * than backsheet: a monocrystalline cell is a pseudo-square, a square wafer
 * with its corners clipped where the round ingot ran out, and a thin gap of
 * white backsheet surrounds it.
 */
export function isCell(x: number, y: number) {
  const gap = 0.025;
  if (x < gap || x > 1 - gap || y < gap || y > 1 - gap) {
    return false;
  }
  const dx = Math.abs(x - 0.5);
  const dy = Math.abs(y - 0.5);
  return dx + dy < 0.86;
}

/** Where the four busbars run down a cell, as shares of its width. */
const BUSBARS = [0.2, 0.4, 0.6, 0.8] as const;

/**
 * The tone at one place of a cell, `x` and `y` from 0 to 1, and whether it
 * is bare silicon, which the crystalline mottle shades.
 */
function toneAt(x: number, y: number, finger: boolean) {
  if (!isCell(x, y)) {
    return { bare: false, tone: TONES.backsheet };
  }
  if (Arr.some(BUSBARS, (at) => Math.abs(x - at) < 0.012)) {
    return { bare: false, tone: TONES.busbar };
  }
  if (finger) {
    return { bare: false, tone: TONES.finger };
  }
  return { bare: true, tone: TONES.cell };
}

/**
 * Paints the face of a solar module with `columns` by `rows` cells, four
 * bytes a pixel: dark blue monocrystalline cells with a faint crystalline
 * mottle, four silver busbars running down each cell and the fine fingers
 * across it, and the white backsheet showing in the gaps.
 */
export function paintSolar(columns: number, rows: number) {
  const width = columns * CELL;
  const height = rows * CELL;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const px = pixel % width;
    const py = Math.floor(pixel / width);
    const x = (px % CELL) / CELL;
    const y = (py % CELL) / CELL;
    const { bare, tone } = toneAt(x, y, py % (CELL / 8) === 0);
    const lit = bare ? 0.9 + 0.2 * grainAt(px / width, py / height, 8, 53) : 1;
    const at = pixel * 4;
    pixels[at] = tone[0] * lit;
    pixels[at + 1] = tone[1] * lit;
    pixels[at + 2] = tone[2] * lit;
    pixels[at + 3] = 255;
  }
  return { height, pixels, width };
}

/**
 * The face of a solar module as a texture, painted once for each layout of
 * cells and then shared.
 */
export function solarTexture(columns: number, rows: number) {
  const key = `${columns}x${rows}`;
  const known = MutableHashMap.get(PAINTED, key);
  if (Option.isSome(known)) {
    return known.value;
  }
  const { height, pixels, width } = paintSolar(columns, rows);
  const texture = new DataTexture(pixels, width, height);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  MutableHashMap.set(PAINTED, key, texture);
  return texture;
}

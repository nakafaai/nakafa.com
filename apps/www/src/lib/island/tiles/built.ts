import { unitOf } from "@/lib/island/noise";
import { type Ramp, type Tone, toneOf } from "@/lib/island/palette";
import {
  blankTile,
  cellsOf,
  flood,
  put,
  speckle,
  TILE,
} from "@/lib/island/tiles/paint";

/** Planks: four boards with a dark seam under each, staggered joints and grain. */
export function planksTile(seed: number) {
  const pixels = blankTile();
  for (let board = 0; board < 4; board += 1) {
    const joint = Math.floor(unitOf(seed, board) * TILE);
    for (let row = 0; row < 4; row += 1) {
      const y = board * 4 + row;
      for (let x = 0; x < TILE; x += 1) {
        const grain = unitOf(seed + 1, Math.floor(x / 4), y) < 0.25 ? 1 : 2;
        const tone: Tone = row === 3 || x === joint ? 0 : grain;
        put(pixels, x, y, "wood", row === 0 && tone !== 0 ? 3 : tone);
      }
    }
  }
  return pixels;
}

/** Cobblestone: rounded stones in dark mortar, lit from the upper left. */
export function cobbleTile(seed: number) {
  const pixels = blankTile();
  const cells = cellsOf(seed, 7);
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const { edge } = cells(x, y);
      const lit = cells(x + 1, y + 1).edge < edge ? 2 : 1;
      put(pixels, x, y, "stone", edge < 1.2 ? 0 : lit);
    }
  }
  return pixels;
}

/** The tone of a brick's pixel `dy` rows below its top: lit on top, shadowed under. */
function brickTone(dy: number, shade: Tone): Tone {
  if (dy === 0) {
    return 3;
  }
  return dy === 2 ? 0 : shade;
}

/** Bricks: half-offset rows of bricks in pale mortar, each brick its own shade. */
export function brickTile(seed: number) {
  const pixels = blankTile();
  flood(pixels, "plaster", 1);
  for (let row = 0; row < 4; row += 1) {
    for (let brick = 0; brick < 2; brick += 1) {
      const shade: Tone = unitOf(seed, row, brick) < 0.35 ? 2 : 1;
      const left = (row % 2) * 4 + brick * 8;
      for (let dy = 0; dy < 3; dy += 1) {
        for (let dx = 0; dx < 7; dx += 1) {
          put(pixels, left + dx, row * 4 + dy, "brick", brickTone(dy, shade));
        }
      }
    }
  }
  return pixels;
}

/** Whether a shingle's pixel is its dark lower lip: the last row, and for a rounded tile the corners above it. */
function isLip(dy: number, across: number, rounded: boolean) {
  return dy === 3 || (rounded && dy === 2 && (across === 0 || across === 3));
}

/** Roof shingles in a ramp: rows of tiles, each lit on top and dark at its lower lip. */
function shinglesTile(seed: number, ramp: Ramp, rounded: boolean) {
  const pixels = blankTile();
  for (let y = 0; y < TILE; y += 1) {
    const dy = y % 4;
    const offset = Math.floor(y / 4) % 2 === 0 ? 0 : 2;
    for (let x = 0; x < TILE; x += 1) {
      const across = (x + offset) % 4;
      const body: Tone =
        unitOf(seed, x, y) < 0.2 || (dy === 1 && across === 0) ? 1 : 2;
      const tone: Tone = dy === 0 ? 3 : body;
      put(pixels, x, y, ramp, isLip(dy, across, rounded) ? 0 : tone);
    }
  }
  return pixels;
}

/** Red clay roof tiles. */
export function roofTile(seed: number) {
  return shinglesTile(seed, "roof", true);
}

/** Blue slate shingles. */
export function slateTile(seed: number) {
  return shinglesTile(seed, "slate", false);
}

/** Plaster: a soft warm wall with a faint grain. */
export function plasterTile(seed: number) {
  const pixels = blankTile();
  speckle(pixels, seed, "plaster", [
    [2, 0.7],
    [1, 0.22],
    [3, 0.08],
  ]);
  return pixels;
}

/** Glass: a dark frame and a clear pane with a diagonal glint. */
export function glassTile() {
  const pixels = blankTile();
  for (let index = 0; index < TILE; index += 1) {
    put(pixels, index, 0, "glass", 0);
    put(pixels, index, TILE - 1, "glass", 0);
    put(pixels, 0, index, "glass", 0);
    put(pixels, TILE - 1, index, "glass", 0);
  }
  for (let step = 0; step < 4; step += 1) {
    put(pixels, 3 + step, 6 - step, "glass", 3);
    put(pixels, 5 + step, 6 - step, "glass", 2);
  }
  return pixels;
}

/** A lantern: an iron frame around a warm flame. */
export function lanternTile() {
  const pixels = blankTile();
  flood(pixels, "metal", 1);
  for (let y = 3; y < 13; y += 1) {
    for (let x = 4; x < 12; x += 1) {
      const heat = Math.hypot(x - 7.5, y - 8) < 2.4 ? 3 : 2;
      put(pixels, x, y, "glow", x === 4 || y === 12 ? 0 : heat);
    }
  }
  for (let x = 0; x < TILE; x += 1) {
    put(pixels, x, 0, "metal", 3);
    put(pixels, x, TILE - 1, "metal", 0);
  }
  return pixels;
}

/** Wool: a knitted weave of rows of small vees. */
export function woolTile(seed: number) {
  const pixels = blankTile();
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const vee = (x + (y % 2)) % 2 === 0;
      const weave: Tone = vee ? 2 : 1;
      put(pixels, x, y, "wool", unitOf(seed, x, y) < 0.08 ? 3 : weave);
    }
  }
  return pixels;
}

/** A bookshelf: two shelves of books between planks. */
export function bookshelfTile(seed: number) {
  const pixels = planksTile(seed);
  for (const shelf of [2, 9] as const) {
    let x = 1;
    while (x < TILE - 1) {
      const width = 1 + Math.floor(unitOf(seed, x, shelf) * 2);
      const tone = toneOf(unitOf(seed + 1, x, shelf));
      const short = unitOf(seed + 2, x, shelf) < 0.3 ? 1 : 0;
      for (let dx = 0; dx < width && x + dx < TILE - 1; dx += 1) {
        for (let dy = short; dy < 5; dy += 1) {
          put(pixels, x + dx, shelf + dy, "book", tone);
        }
      }
      x += width + 1;
    }
  }
  return pixels;
}

/** Marble: pale stone with grey veins. */
export function marbleTile(seed: number) {
  const pixels = blankTile();
  speckle(pixels, seed, "marble", [
    [2, 0.75],
    [3, 0.25],
  ]);
  let x = Math.floor(unitOf(seed, 1) * TILE);
  for (let y = 0; y < TILE; y += 1) {
    put(pixels, x, y, "marble", 0);
    x += unitOf(seed, y, 9) < 0.5 ? 1 : 0;
  }
  return pixels;
}

/** Gold: a bevelled block, bright at the upper left and deep at the lower right. */
export function goldTile(seed: number) {
  const pixels = blankTile();
  speckle(pixels, seed, "gold", [
    [2, 0.8],
    [3, 0.2],
  ]);
  for (let index = 0; index < TILE; index += 1) {
    put(pixels, index, 0, "gold", 3);
    put(pixels, 0, index, "gold", 3);
    put(pixels, index, TILE - 1, "gold", 0);
    put(pixels, TILE - 1, index, "gold", 0);
  }
  return pixels;
}

import { Array as Arr, Option } from "effect";
import type { Ramp, Tone } from "@/lib/island/palette";
import { blankTile, put, TILE } from "@/lib/island/tiles/paint";

/**
 * What a cell of a sprite's shape holds before it is colored: empty, the body,
 * the belly, an accent (a beak, a mane, fins), the eye, a pattern mark, a pale
 * part (horn, tusk, shell rim), a dark part (antlers, beetle heads), or a leg
 * in the body's shade.
 */
export const PART = {
  accent: 3,
  belly: 2,
  body: 1,
  dark: 7,
  empty: 0,
  eye: 4,
  leg: 8,
  mark: 5,
  pale: 6,
} as const;

/** A sprite's shape: one part per cell of a tile, row by row. */
export type Shape = Uint8Array<ArrayBuffer>;

/** An empty shape. */
export function emptyShape(): Shape {
  return new Uint8Array(new ArrayBuffer(TILE * TILE));
}

/** Sets one cell, ignoring cells outside the tile. */
export function setCell(shape: Shape, x: number, y: number, part: number) {
  const column = Math.round(x);
  const row = Math.round(y);
  if (column < 0 || row < 0 || column >= TILE || row >= TILE) {
    return;
  }
  shape[row * TILE + column] = part;
}

/** The part of one cell, empty outside the tile. */
function cellAt(shape: Shape, x: number, y: number) {
  if (x < 0 || y < 0 || x >= TILE || y >= TILE) {
    return PART.empty;
  }
  return shape[y * TILE + x];
}

/** Fills an ellipse centered on (cx, cy) with radii (rx, ry), measured at pixel centers. */
export function ellipse(
  shape: Shape,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  part: number
) {
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        setCell(shape, x, y, part);
      }
    }
  }
}

/** Fills a rectangle from (x0, y0) to (x1, y1), inclusive. */
export function box(
  shape: Shape,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  part: number
) {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      setCell(shape, x, y, part);
    }
  }
}

/** Draws a line from (x0, y0) to (x1, y1), one cell wide or `width` cells across. */
export function line(
  shape: Shape,
  from: readonly [number, number],
  to: readonly [number, number],
  part: number,
  width = 1
) {
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])))
  );
  for (let step = 0; step <= steps; step += 1) {
    const x = from[0] + ((to[0] - from[0]) * step) / steps;
    const y = from[1] + ((to[1] - from[1]) * step) / steps;
    for (let dx = 0; dx < width; dx += 1) {
      setCell(shape, x + dx, y, part);
    }
  }
}

/** Marks body cells with a pattern: spots, stripes across, a saddle patch, or none. */
export function markBody(
  shape: Shape,
  pattern: "none" | "spots" | "stripes" | "patch" | "bands"
) {
  if (pattern === "none") {
    return;
  }
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      if (cellAt(shape, x, y) !== PART.body) {
        continue;
      }
      const marked = {
        bands: y % 3 === 0,
        patch: x >= 4 && x <= 8 && y <= 10,
        spots: (x * 3 + y * 5) % 7 === 0,
        stripes: x % 3 === 1,
      }[pattern];
      if (marked) {
        setCell(shape, x, y, PART.mark);
      }
    }
  }
}

/** The colors a shape is painted in: each part's ramp, and the eye's. */
type Coat = Readonly<Record<"body" | "belly" | "accent" | "mark", Ramp>>;

/** The tone of a filled cell: lit from above, shaded below, the base between. */
function toneAt(shape: Shape, x: number, y: number): Tone {
  if (cellAt(shape, x, y - 1) === PART.empty) {
    return 3;
  }
  return cellAt(shape, x, y + 1) === PART.empty ? 1 : 2;
}

/** The ramp each part is painted from. */
function rampOf(part: number, coat: Coat): Ramp {
  if (part === PART.accent) {
    return coat.accent;
  }
  if (part === PART.belly) {
    return coat.belly;
  }
  if (part === PART.mark) {
    return coat.mark;
  }
  if (part === PART.dark || part === PART.eye) {
    return "ink";
  }
  return part === PART.pale ? "plaster" : coat.body;
}

/** The tone of a filled cell of a part: marks and legs sit a tone darker, the belly a tone lighter, eyes and dark parts darkest. */
function partTone(part: number, tone: Tone): Tone {
  if (part === PART.eye) {
    return 0;
  }
  if (part === PART.dark) {
    return 1;
  }
  if (part === PART.leg || part === PART.mark) {
    return tone === 3 ? 2 : 1;
  }
  if (part === PART.belly) {
    return tone === 1 ? 2 : 3;
  }
  return tone;
}

/** The first filled neighbor of an empty cell, whose ramp outlines it; none when it touches nothing. */
function neighborOf(shape: Shape, x: number, y: number) {
  return Arr.findFirst(
    [
      cellAt(shape, x, y + 1),
      cellAt(shape, x - 1, y),
      cellAt(shape, x + 1, y),
      cellAt(shape, x, y - 1),
    ],
    (part) => part !== PART.empty
  );
}

/**
 * Paints a shape into a tile: every part in its coat's ramp, lit from above
 * and shaded below, and a one-pixel outline around it in the darkest tone of
 * the part it borders, so every sprite reads as one tidy silhouette.
 */
export function paintShape(shape: Shape, coat: Coat) {
  const pixels = blankTile();
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const part = cellAt(shape, x, y);
      if (part !== PART.empty) {
        put(
          pixels,
          x,
          y,
          rampOf(part, coat),
          partTone(part, toneAt(shape, x, y))
        );
        continue;
      }
      Option.map(neighborOf(shape, x, y), (border) =>
        put(pixels, x, y, rampOf(border, coat), 0)
      );
    }
  }
  return pixels;
}

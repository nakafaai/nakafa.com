import {
  cellsAt,
  chanceAt,
  fractalAt,
  ridgedAt,
  warpedAt,
} from "@repo/design-system/components/three/field/noise";
import {
  paintNormals,
  paintOpenness,
} from "@repo/design-system/components/three/surface/relief";
import { Schema } from "effect";

/** The real surfaces a lab object is made of, each with its own fine detail. */
export const SurfaceSchema = Schema.Literals([
  "bark",
  "brushed",
  "cast",
  "ceramic",
  "cloth",
  "concrete",
  "knurl",
  "leaf",
  "paint",
  "planks",
  "plastic",
  "rubber",
  "slate",
  "stone",
  "tissue",
  "wood",
  "hide",
  "scales",
  "mucosa",
  "sand",
  "cytoplasm",
]);
export type Surface = typeof SurfaceSchema.Type;

/**
 * How one surface varies across a tile: how far its tone dips below the
 * object's colour, how rough it is at its smoothest and how much rougher its
 * worn places get, and how deep its relief stands.
 */
const LookSchema = Schema.Struct({
  dip: Schema.Finite,
  relief: Schema.Finite,
  rough: Schema.Finite,
  wear: Schema.Finite,
});

const LOOKS: Record<Surface, typeof LookSchema.Type> = {
  bark: { dip: 0.6, relief: 1, rough: 0.9, wear: 0.06 },
  brushed: { dip: 0.16, relief: 0.1, rough: 0.28, wear: 0.18 },
  cast: { dip: 0.22, relief: 0.3, rough: 0.6, wear: 0.2 },
  ceramic: { dip: 0.1, relief: 0.08, rough: 0.12, wear: 0.1 },
  cloth: { dip: 0.3, relief: 0.5, rough: 0.82, wear: 0.1 },
  concrete: { dip: 0.28, relief: 0.4, rough: 0.88, wear: 0.1 },
  knurl: { dip: 0.3, relief: 0.6, rough: 0.34, wear: 0.16 },
  leaf: { dip: 0.3, relief: 0.3, rough: 0.5, wear: 0.2 },
  paint: { dip: 0.14, relief: 0.035, rough: 0.38, wear: 0.34 },
  planks: { dip: 0.5, relief: 0.22, rough: 0.46, wear: 0.16 },
  plastic: { dip: 0.06, relief: 0.05, rough: 0.42, wear: 0.12 },
  rubber: { dip: 0.14, relief: 0.2, rough: 0.86, wear: 0.08 },
  slate: { dip: 0.3, relief: 0.5, rough: 0.7, wear: 0.16 },
  stone: { dip: 0.42, relief: 0.9, rough: 0.9, wear: 0.08 },
  tissue: { dip: 0.3, relief: 0.5, rough: 0.55, wear: 0.2 },
  wood: { dip: 0.4, relief: 0.16, rough: 0.6, wear: 0.18 },
  hide: { dip: 0.34, relief: 0.55, rough: 0.56, wear: 0.24 },
  scales: { dip: 0.3, relief: 0.5, rough: 0.24, wear: 0.2 },
  mucosa: { dip: 0.26, relief: 0.32, rough: 0.2, wear: 0.16 },
  sand: { dip: 0.3, relief: 0.6, rough: 0.9, wear: 0.06 },
  cytoplasm: { dip: 0.16, relief: 0.16, rough: 0.28, wear: 0.12 },
};

/** How tall the deepest relief stands, in tile widths. */
const DEEPEST = 0.045;

/** How far a pixel looks for what shades it, in pixels of a 256 pixel tile. */
const SHADE_REACH = 2 / 256;

/** How dark a pixel in a pit gets under the sky's light. */
const SHADE_STRENGTH = 3.2;

/** How much of a pit's shade is also painted into the tone. */
const SHADE_IN_TONE = 0.3;

/** A number held between 0 and 1. */
function held(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** How far a place is from the middle of its own stripe of `count` stripes, from 0 to 1. */
function fromStripe(place: number, count: number) {
  const along = place * count;
  return Math.abs(along - Math.floor(along) - 0.5) * 2;
}

/** How many boards lie side by side across one tile of planks. */
export const BOARDS = 4;

/** The share of a board's width that slopes into the groove at each edge. */
const GROOVE = 0.05;

/** How much darker the darkest board of a floor is than the palest. */
const BOARD_TONES = 0.24;

/**
 * Sawn wood at a place of the tile: long pores along the grain, across the
 * darker late wood of growth rings that a slow figure bends.
 */
function woodAt(x: number, y: number) {
  const figure = warpedAt(x, y, 1, 3, 31, 0.3);
  const ring = 0.5 + 0.5 * Math.sin((y * 9 + 3.2 * figure) * 2 * Math.PI);
  const late = ring ** 5;
  const pores = fractalAt(x, y, 4, 160, 37, 2);
  const band = fractalAt(x, y, 2, 20, 39, 3);
  return {
    height: 0.6 + 0.5 * (pores - 0.5) - 0.25 * late,
    shade: 0.92 - 0.3 * late - 0.4 * (1 - pores) - 0.25 * (1 - band),
  };
}

/**
 * What each surface is at a place of the tile: its `height`, between 0 and
 * 1, where 1 stands highest, and its `shade`, where 1 is the surface at its
 * cleanest and brightest.
 *
 * Bark stands in long fibrous ridges between deep furrows. Brushed metal is
 * streaked along its length. Cast metal is finely pitted from its sand
 * mould. Glazed ceramic is nearly flat under a net of hairline crazing.
 * Cloth is a plain weave of round threads. Concrete is mottled and pitted
 * with air holes. A knurl is a grid of small pyramids for a thumb to grip. A
 * leaf's veins sweep from its midrib across a mesh of smaller cells. Paint
 * has a faint orange peel, soft blotches of grime and scuffs. Planks are
 * boards of sawn wood laid side by side, each from its own stretch of the
 * tree and of its own tone, with a groove where two meet. Plastic is
 * nearly even, moulded with a fine pebble. Rubber is finely dimpled. Slate
 * breaks in flat beds with sharp steps between them. Stone is craggy and
 * cracked. Living tissue is a mosaic of domed cells. Wood runs in long pores
 * across darker growth rings. Hide is the thick skin of a sea cow, a whale
 * or a tapir: a net of fine creases round small plates, pitted with pores.
 * Scales overlap in staggered rows, each standing proud at its free edge.
 * Mucosa is wet living lining, softly folded and threaded with fine vessels.
 * Sand lies in ripples the water left, grain by grain. Cytoplasm is the
 * inside of one living cell seen through its membrane: clouded, and
 * speckled with granules.
 */
const PATTERNS: Record<
  Surface,
  (x: number, y: number) => { readonly height: number; readonly shade: number }
> = {
  bark: (x, y) => {
    const sway = 0.14 * (fractalAt(x, y, 2, 3, 43, 3) - 0.5);
    const furrow = ridgedAt(x + sway, y, 5, 2, 41, 2);
    const ridge = 1 - held(furrow * 1.6) ** 0.8;
    const fibres = ridgedAt(x + sway, y, 34, 3, 47, 2);
    const flakes = fractalAt(x + sway, y, 12, 5, 53, 3);
    return {
      height:
        ridge * (0.5 + 0.28 * fibres + 0.22 * flakes) +
        0.08 * fractalAt(x, y, 64, 32, 55, 2),
      shade: 0.12 + 0.5 * ridge + 0.18 * fibres + 0.2 * flakes,
    };
  },
  brushed: (x, y) => {
    const streaks = fractalAt(x, y, 3, 96, 3, 2);
    return {
      height: streaks,
      shade: 0.55 + 0.3 * streaks + 0.15 * fractalAt(x, y, 4, 4, 5, 3),
    };
  },
  cast: (x, y) => {
    const grain = fractalAt(x, y, 56, 56, 127, 3);
    const pores = cellsAt(x, y, 36, 36, 131);
    const pore = pores.owner < 0.3 ? held(1 - pores.nearest * 3) : 0;
    return {
      height: 0.25 + 0.75 * grain - 0.5 * pore,
      shade: 0.6 + 0.4 * fractalAt(x, y, 8, 8, 137, 3) - 0.3 * pore,
    };
  },
  ceramic: (x, y) => {
    const sway = 0.06 * (fractalAt(x, y, 4, 4, 105, 2) - 0.5);
    const craze = cellsAt(x + sway, y - sway, 6, 6, 103);
    const whole = held((craze.second - craze.nearest) * 28);
    return {
      height: 0.4 + 0.5 * fractalAt(x, y, 20, 20, 107, 2) - 0.15 * (1 - whole),
      shade: 0.7 + 0.3 * whole,
    };
  },
  cloth: (x, y) => {
    const warp = Math.cos((Math.PI / 2) * fromStripe(x, 64));
    const weft = Math.cos((Math.PI / 2) * fromStripe(y, 64));
    // Warp and weft cross over and under each other in alternate threads.
    const over = (Math.floor(x * 64) + Math.floor(y * 64)) % 2;
    const upper = over === 0 ? warp : weft;
    const under = over === 0 ? weft : warp;
    const thread = upper * (0.6 + 0.4 * under);
    return {
      height: 0.15 + 0.7 * thread + 0.15 * fractalAt(x, y, 128, 128, 5, 1),
      shade: 0.45 + 0.4 * thread + 0.15 * fractalAt(x, y, 8, 8, 7, 3),
    };
  },
  concrete: (x, y) => {
    const holes = cellsAt(x, y, 22, 22, 61);
    const hole =
      holes.owner < 0.3 ? held(1 - holes.nearest * (2.5 + 9 * holes.owner)) : 0;
    const mottle = fractalAt(x, y, 10, 10, 59);
    return {
      height:
        0.35 +
        0.35 * mottle +
        0.3 * fractalAt(x, y, 80, 80, 63, 2) -
        0.6 * hole,
      shade: 0.45 + 0.55 * fractalAt(x, y, 5, 5, 57) - 0.3 * hole,
    };
  },
  knurl: (x, y) => {
    const peak = 1 - Math.max(fromStripe(x + y, 24), fromStripe(x - y, 24));
    return { height: peak, shade: 0.55 + 0.45 * peak };
  },
  leaf: (x, y) => {
    const side = Math.abs(y - 0.5);
    const lateral = held(
      1 - Math.abs(Math.sin(Math.PI * (x * 7 - side * 5))) * 9
    );
    const midrib = held(1 - side * 44);
    const cells = cellsAt(x, y, 56, 56, 109);
    const mesh = held(1 - (cells.second - cells.nearest) * 4);
    const vein = held(Math.max(lateral * (1 - 1.6 * side), midrib));
    const swell = Math.abs(Math.sin(Math.PI * (x * 7 - side * 5)));
    return {
      height: 0.45 + 0.3 * swell - 0.12 * mesh - 0.4 * vein,
      shade:
        0.6 +
        0.4 * vein -
        0.1 * mesh +
        0.2 * (fractalAt(x, y, 6, 6, 113, 3) - 0.5),
    };
  },
  paint: (x, y) => ({
    height: fractalAt(x, y, 40, 40, 19, 2),
    shade:
      1 -
      0.7 * fractalAt(x, y, 4, 4, 11) ** 3 -
      0.3 * fractalAt(x, y, 32, 32, 17) ** 4,
  }),
  planks: (x, y) => {
    const across = y * BOARDS;
    const board = Math.floor(across);
    const within = across - board;
    const flat = held(Math.min(within, 1 - within) / GROOVE);
    const sawn = woodAt(x + 0.37 * board, y + 0.29 * board);
    return {
      height: (0.88 + 0.12 * sawn.height) * flat ** 0.5,
      shade:
        (0.5 + 0.5 * sawn.shade) *
        (1 - BOARD_TONES * chanceAt(board, 0, 151)) *
        (0.35 + 0.65 * flat),
    };
  },
  plastic: (x, y) => ({
    height: fractalAt(x, y, 96, 96, 23, 1),
    shade: 0.8 + 0.2 * fractalAt(x, y, 16, 16, 27),
  }),
  rubber: (x, y) => {
    const dimples = cellsAt(x, y, 64, 64, 29);
    const dimple = held(1 - dimples.nearest * 2.2);
    return {
      height: 0.8 - 0.6 * dimple ** 2,
      shade: 0.6 + 0.4 * fractalAt(x, y, 48, 48, 33, 3),
    };
  },
  slate: (x, y) => {
    const bed = warpedAt(x, y, 3, 3, 89, 0.2) * 6;
    const tread = Math.floor(bed);
    const riser = held((bed - tread - 0.88) / 0.12);
    return {
      height:
        0.08 +
        (0.8 * (tread + riser)) / 6 +
        0.12 * fractalAt(x, y, 64, 64, 97, 2),
      shade: 0.5 + 0.4 * fractalAt(x, y, 8, 8, 101) + 0.1 * (1 - riser),
    };
  },
  stone: (x, y) => {
    const body = warpedAt(x, y, 4, 4, 73, 0.3);
    const sway = 0.22 * (body - 0.5);
    const cracks = cellsAt(x + sway, y - sway, 3, 3, 79);
    const whole = held((cracks.second - cracks.nearest) * 22);
    return {
      height:
        (0.4 * body +
          0.4 * ridgedAt(x, y, 6, 6, 71) +
          0.2 * fractalAt(x, y, 56, 56, 83, 2)) *
        (0.6 + 0.4 * whole),
      shade: 0.35 + 0.5 * body + 0.15 * whole,
    };
  },
  tissue: (x, y) => {
    const cells = cellsAt(x, y, 18, 18, 139);
    const body = held((cells.second - cells.nearest) * 3.5);
    return {
      height: 0.1 + 0.75 * body ** 0.5 + 0.15 * fractalAt(x, y, 64, 64, 149, 2),
      shade: 0.5 + 0.3 * body + 0.2 * cells.owner,
    };
  },
  wood: woodAt,
  hide: (x, y) => {
    const sway = 0.05 * (fractalAt(x, y, 5, 5, 157, 2) - 0.5);
    const plates = cellsAt(x + sway, y - sway, 22, 14, 163);
    const whole = held((plates.second - plates.nearest) * 5);
    const pores = cellsAt(x, y, 72, 72, 167);
    const pore = pores.owner < 0.25 ? held(1 - pores.nearest * 3.4) : 0;
    const folds = ridgedAt(x, y, 3, 9, 173, 2);
    return {
      height: 0.2 + 0.5 * whole ** 0.6 + 0.3 * folds - 0.35 * pore,
      shade:
        0.45 +
        0.3 * whole +
        0.25 * fractalAt(x, y, 6, 6, 179, 3) -
        0.2 * pore,
    };
  },
  scales: (x, y) => {
    const row = Math.floor(y * 28);
    const within = y * 28 - row;
    const across = x * 28 + (row % 2) * 0.5;
    const off = Math.abs(across - Math.floor(across) - 0.5) * 2;
    const edge = held((1 - off * off - within) * 6);
    const lift = within * edge;
    return {
      height: 0.15 + 0.85 * lift,
      shade:
        0.5 +
        0.35 * edge * (0.4 + 0.6 * within) +
        0.15 * fractalAt(x, y, 9, 9, 181, 2),
    };
  },
  mucosa: (x, y) => {
    const folds = fractalAt(x, y, 5, 7, 191, 3);
    const vessels = held(ridgedAt(x, y, 6, 6, 193, 3) * 2.4 - 1.1);
    return {
      height:
        0.3 +
        0.45 * folds +
        0.15 * fractalAt(x, y, 44, 44, 197, 2) +
        0.1 * vessels,
      shade: 0.72 + 0.28 * folds - 0.3 * vessels,
    };
  },
  sand: (x, y) => {
    const sway = 0.5 * (fractalAt(x, y, 3, 3, 199, 2) - 0.5);
    const ripple = 0.5 + 0.5 * Math.sin((y * 9 + sway) * 2 * Math.PI);
    const grains = cellsAt(x, y, 96, 96, 211);
    const grain = held(1 - grains.nearest * 1.8);
    return {
      height: 0.55 * ripple ** 1.5 + 0.3 * grain + 0.15 * grains.owner,
      shade: 0.5 + 0.25 * ripple + 0.25 * grains.owner,
    };
  },
  cytoplasm: (x, y) => {
    const cloud = fractalAt(x, y, 5, 5, 223, 3);
    const granules = cellsAt(x, y, 54, 54, 227);
    const granule =
      granules.owner < 0.45 ? held(1 - granules.nearest * 2.6) : 0;
    return {
      height: 0.35 + 0.35 * cloud + 0.3 * granule,
      shade: 0.74 + 0.26 * cloud - 0.22 * granule,
    };
  },
};

/**
 * Paints the fine detail of one surface as three square images of `size`
 * pixels that tile without a seam, four bytes a pixel. `tone` multiplies the
 * object's own colour, so one image serves every colour of that surface.
 * `normal` holds which way each pixel faces, so the relief bends the light
 * smoothly however close the camera comes. `finish` holds how open each
 * pixel is to the sky in its red channel and its roughness in its green
 * channel, where a renderer reads them.
 */
export function paintDetail(surface: Surface, size: number) {
  const { dip, relief, rough, wear } = LOOKS[surface];
  const heights = new Float32Array(size * size);
  const shades = new Float32Array(size * size);
  for (let pixel = 0; pixel < size * size; pixel += 1) {
    const x = (pixel % size) / size;
    const y = Math.floor(pixel / size) / size;
    const { height, shade } = PATTERNS[surface](x, y);
    heights[pixel] = held(height);
    shades[pixel] = held(shade);
  }
  const open = paintOpenness(
    heights,
    size,
    Math.max(1, Math.round(SHADE_REACH * size)),
    SHADE_STRENGTH * relief
  );
  const tone = new Uint8ClampedArray(size * size * 4);
  const finish = new Uint8ClampedArray(size * size * 4);
  for (let pixel = 0; pixel < size * size; pixel += 1) {
    const x = (pixel % size) / size;
    const y = Math.floor(pixel / size) / size;
    const shade = Number(shades[pixel]);
    const sky = Number(open[pixel]);
    const lit = (1 - dip * (1 - shade)) * (1 - SHADE_IN_TONE * (1 - sky)) * 255;
    const worn = fractalAt(x, y, 8, 8, 41, 3);
    const grit = Math.min(1, rough + wear * worn * (1.2 - shade));
    tone.set([lit, lit, lit, 255], pixel * 4);
    finish.set([sky * 255, grit * 255, 255, 255], pixel * 4);
  }
  return {
    finish,
    normal: paintNormals(heights, size, relief * DEEPEST),
    tone,
  };
}

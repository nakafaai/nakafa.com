import {
  cellsAt,
  fractalAt,
  ridgedAt,
  warpedAt,
} from "@repo/design-system/components/three/field/noise";
import {
  anodisedAt,
  brushedAt,
  castAt,
  knurlAt,
  machinedAt,
  polishedAt,
  windingAt,
} from "@repo/design-system/components/three/surface/metal";
import {
  corkAt,
  feltAt,
  foamAt,
  paperAt,
} from "@repo/design-system/components/three/surface/pressed";
import {
  paintNormals,
  paintOpenness,
} from "@repo/design-system/components/three/surface/relief";
import {
  fromStripe,
  held,
} from "@repo/design-system/components/three/surface/tile";
import {
  planksAt,
  woodAt,
} from "@repo/design-system/components/three/surface/wood";
import { Schema } from "effect";

/** The real surfaces a lab object is made of, each with its own fine detail. */
export const SurfaceSchema = Schema.Literals([
  "anodised",
  "asphalt",
  "bark",
  "brushed",
  "cast",
  "ceramic",
  "cloth",
  "concrete",
  "cork",
  "felt",
  "foam",
  "grass",
  "knurl",
  "leaf",
  "machined",
  "paint",
  "paper",
  "planks",
  "plastic",
  "polished",
  "resin",
  "rubber",
  "slate",
  "snow",
  "soil",
  "stone",
  "tissue",
  "winding",
  "wood",
  "hide",
  "scales",
  "mucosa",
  "sand",
  "cytoplasm",
  "fur",
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
  anodised: { dip: 0.08, relief: 0.05, rough: 0.46, wear: 0.14 },
  asphalt: { dip: 0.55, relief: 0.5, rough: 0.82, wear: 0.12 },
  bark: { dip: 0.6, relief: 1, rough: 0.9, wear: 0.06 },
  brushed: { dip: 0.16, relief: 0.1, rough: 0.28, wear: 0.18 },
  cast: { dip: 0.22, relief: 0.3, rough: 0.6, wear: 0.2 },
  ceramic: { dip: 0.1, relief: 0.08, rough: 0.12, wear: 0.1 },
  cloth: { dip: 0.3, relief: 0.5, rough: 0.82, wear: 0.1 },
  concrete: { dip: 0.28, relief: 0.4, rough: 0.88, wear: 0.1 },
  cork: { dip: 0.4, relief: 0.5, rough: 0.9, wear: 0.06 },
  felt: { dip: 0.26, relief: 0.4, rough: 0.96, wear: 0.04 },
  foam: { dip: 0.16, relief: 0.35, rough: 0.92, wear: 0.04 },
  grass: { dip: 0.6, relief: 0.8, rough: 0.86, wear: 0.06 },
  knurl: { dip: 0.3, relief: 0.6, rough: 0.34, wear: 0.16 },
  leaf: { dip: 0.3, relief: 0.3, rough: 0.5, wear: 0.2 },
  machined: { dip: 0.1, relief: 0.09, rough: 0.2, wear: 0.16 },
  paint: { dip: 0.14, relief: 0.035, rough: 0.38, wear: 0.34 },
  paper: { dip: 0.08, relief: 0.1, rough: 0.88, wear: 0.06 },
  planks: { dip: 0.5, relief: 0.22, rough: 0.46, wear: 0.16 },
  plastic: { dip: 0.06, relief: 0.05, rough: 0.42, wear: 0.12 },
  polished: { dip: 0.07, relief: 0.03, rough: 0.1, wear: 0.22 },
  resin: { dip: 0.2, relief: 0.08, rough: 0.62, wear: 0.25 },
  rubber: { dip: 0.14, relief: 0.2, rough: 0.86, wear: 0.08 },
  slate: { dip: 0.3, relief: 0.5, rough: 0.7, wear: 0.16 },
  snow: { dip: 0.12, relief: 0.45, rough: 0.6, wear: 0.3 },
  soil: { dip: 0.55, relief: 0.85, rough: 0.94, wear: 0.05 },
  stone: { dip: 0.42, relief: 0.9, rough: 0.9, wear: 0.08 },
  tissue: { dip: 0.3, relief: 0.5, rough: 0.55, wear: 0.2 },
  winding: { dip: 0.3, relief: 0.45, rough: 0.3, wear: 0.1 },
  wood: { dip: 0.55, relief: 0.16, rough: 0.6, wear: 0.18 },
  hide: { dip: 0.34, relief: 0.55, rough: 0.56, wear: 0.24 },
  scales: { dip: 0.3, relief: 0.5, rough: 0.24, wear: 0.2 },
  mucosa: { dip: 0.26, relief: 0.32, rough: 0.2, wear: 0.16 },
  sand: { dip: 0.3, relief: 0.6, rough: 0.9, wear: 0.06 },
  cytoplasm: { dip: 0.16, relief: 0.16, rough: 0.28, wear: 0.12 },
  fur: { dip: 0.3, relief: 0.5, rough: 0.72, wear: 0.24 },
};

/** How tall the deepest relief stands, in tile widths. */
const DEEPEST = 0.045;

/** How far a pixel looks for what shades it, in pixels of a 256 pixel tile. */
const SHADE_REACH = 2 / 256;

/** How dark a pixel in a pit gets under the sky's light. */
const SHADE_STRENGTH = 3.2;

/** How much of a pit's shade is also painted into the tone. */
const SHADE_IN_TONE = 0.3;

/** How many boards lie side by side across one tile of planks. */
export const BOARDS = 4;

/**
 * What each surface is at a place of the tile: its `height`, between 0 and
 * 1, where 1 stands highest, and its `shade`, where 1 is the surface at its
 * cleanest and brightest.
 *
 * Anodised aluminium is a satin etch over the faint lines of its extrusion.
 * Asphalt is crushed stone bedded in dark binder. Bark stands in long
 * fibrous ridges between deep furrows. Brushed metal is
 * streaked along its length. Cast metal is finely pitted from its sand
 * mould. Glazed ceramic is nearly flat under a net of hairline crazing.
 * Cloth is a plain weave of round threads. Concrete is mottled and pitted
 * with air holes. Cork is pressed granules with dark walls and open pits.
 * Felt is matted fibres lying every way, with no weave. Foam is expanded
 * beads pressed together, creased where they meet. Grass is a thatch of
 * blades leaning every way, thicker in clumps. A knurl is a grid of small
 * pyramids for a thumb to grip. A leaf's veins sweep from its midrib across
 * a mesh of smaller cells. Machined metal carries the fine cusps a lathe
 * tool leaves around a turned part. Paint has a faint orange peel, soft
 * blotches of grime and scuffs. Paper is a felt of fibres with a fine tooth
 * and a cloudy formation. Planks are
 * boards of sawn wood laid side by side, each from its own stretch of the
 * tree and of its own tone, with a groove where two meet. Plastic is
 * nearly even, moulded with a fine pebble. Polished metal is a mirror
 * crossed by hairline scratches and dulled by smudges. Cast resin is flat
 * and dark under pale specks of its filler. Rubber is finely dimpled. Sand
 * lies in soft ripples the wind combed, grain on grain. Slate breaks in flat
 * beds with sharp steps between them. Snow drifts under a fine crust. Soil
 * is clods and crumbs with a pale pebble here and there. Stone is craggy and
 * cracked. Living tissue is a mosaic of domed cells. A winding is round wire
 * laid turn beside turn. Wood runs in long pores across the dark late wood
 * of growth rings, over broad bands of heart and sap wood. Hide is the thick
 * skin of a sea cow, a whale or a tapir: a net of fine creases round small
 * plates, pitted with pores. Scales overlap in staggered rows, each standing
 * proud at its free edge. Mucosa is wet living lining, softly folded and
 * threaded with fine vessels. Sand lies in ripples the water left, grain by
 * grain. Cytoplasm is the inside of one living cell seen through its
 * membrane: clouded, and speckled with granules. Fur is a short coat that
 * lies one way: fine strands in soft clumps.
 */
const PATTERNS: Record<
  Surface,
  (x: number, y: number) => { readonly height: number; readonly shade: number }
> = {
  anodised: anodisedAt,
  asphalt: (x, y) => {
    const stones = cellsAt(x, y, 44, 44, 163);
    const stone = held(1.25 - stones.nearest * 2.6);
    return {
      height: 0.2 + 0.6 * stone ** 0.6 + 0.2 * fractalAt(x, y, 96, 96, 167, 2),
      shade:
        0.2 +
        0.55 * stone * (0.35 + 0.65 * stones.owner) +
        0.25 * fractalAt(x, y, 7, 7, 169, 3),
    };
  },
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
  brushed: brushedAt,
  cast: castAt,
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
  cork: corkAt,
  felt: feltAt,
  foam: foamAt,
  grass: (x, y) => {
    const clump = (seed: number) =>
      0.55 + 0.9 * (fractalAt(x, y, 9, 9, seed, 2) - 0.5);
    // Blades lean along the tile, across it and along both diagonals.
    const blades = held(
      1.5 *
        Math.max(
          ridgedAt(x, y, 96, 12, 179, 2) * clump(173),
          ridgedAt(x, y, 12, 96, 181, 2) * clump(175),
          ridgedAt(x + y, x - y, 68, 9, 191, 2) * clump(177),
          ridgedAt(x + y, x - y, 9, 68, 193, 2) * clump(183)
        )
    );
    const thatch = fractalAt(x, y, 20, 20, 195, 3);
    return {
      height: 0.25 * thatch + 0.75 * blades,
      shade: 0.15 + 0.3 * thatch + 0.6 * blades,
    };
  },
  knurl: knurlAt,
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
  machined: machinedAt,
  paint: (x, y) => ({
    height: fractalAt(x, y, 40, 40, 19, 2),
    shade:
      1 -
      0.7 * fractalAt(x, y, 4, 4, 11) ** 3 -
      0.3 * fractalAt(x, y, 32, 32, 17) ** 4,
  }),
  paper: paperAt,
  planks: (x, y) => planksAt(x, y, BOARDS),
  plastic: (x, y) => ({
    height: fractalAt(x, y, 96, 96, 23, 1),
    shade: 0.8 + 0.2 * fractalAt(x, y, 16, 16, 27),
  }),
  polished: polishedAt,
  resin: (x, y) => {
    const specks = cellsAt(x, y, 64, 64, 197);
    const speck = specks.owner < 0.12 ? held(1 - specks.nearest * 3.6) : 0;
    return {
      height: fractalAt(x, y, 28, 28, 199, 2),
      shade: 0.45 + 0.35 * fractalAt(x, y, 5, 5, 227, 3) + 0.5 * speck,
    };
  },
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
  snow: (x, y) => {
    const drift = fractalAt(x, y, 4, 4, 239, 3);
    const crust = fractalAt(x, y, 40, 40, 241, 3);
    const crystal = held(1 - cellsAt(x, y, 96, 96, 251).nearest * 3);
    return {
      height: 0.6 * drift + 0.3 * crust + 0.1 * crystal,
      shade: 0.5 + 0.3 * drift + 0.2 * crust,
    };
  },
  soil: (x, y) => {
    const sway = 0.05 * (fractalAt(x, y, 6, 6, 257, 2) - 0.5);
    const clod = held(1 - cellsAt(x + sway, y - sway, 9, 9, 263).nearest * 1.4);
    const crumb = held(
      1 - cellsAt(x - sway, y + sway, 26, 26, 265).nearest * 1.7
    );
    const pebbles = cellsAt(x, y, 30, 30, 269);
    const pebble = pebbles.owner < 0.12 ? held(1.2 - pebbles.nearest * 4.4) : 0;
    const dust = fractalAt(x, y, 80, 80, 271, 3);
    return {
      height: 0.3 * clod + 0.3 * crumb + 0.25 * dust + 0.3 * pebble ** 0.5,
      shade: 0.15 + 0.25 * clod + 0.2 * crumb + 0.3 * dust + 0.5 * pebble,
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
  winding: windingAt,
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
        0.45 + 0.3 * whole + 0.25 * fractalAt(x, y, 6, 6, 179, 3) - 0.2 * pore,
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
  fur: (x, y) => {
    const strands = fractalAt(x, y, 9, 150, 229, 3);
    const clumps = fractalAt(x, y, 7, 12, 233, 2);
    const tips = ridgedAt(x, y, 14, 220, 239, 2);
    return {
      height: 0.2 + 0.45 * strands + 0.2 * clumps + 0.15 * tips,
      shade: 0.52 + 0.3 * strands + 0.18 * clumps,
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

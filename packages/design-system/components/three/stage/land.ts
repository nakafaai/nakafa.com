import {
  chanceAt,
  fractalAt,
} from "@repo/design-system/components/three/field/noise";
import {
  BOARDS,
  SurfaceSchema,
} from "@repo/design-system/components/three/surface/detail";
import { Schema } from "effect";

/**
 * What a lab stands on: open ground outdoors (asphalt, concrete, grass, sand,
 * snow, soil), or a top inside a room (an epoxy resin bench, or a planked
 * maple, oak or walnut table).
 */
export const GroundSchema = Schema.Literals([
  "asphalt",
  "concrete",
  "epoxy",
  "grass",
  "maple",
  "oak",
  "sand",
  "snow",
  "soil",
  "walnut",
]);
export type Ground = typeof GroundSchema.Type;

/** One tone as its red, green and blue, each from 0 to 255. */
const ToneSchema = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);

/**
 * How one ground lies: the surface it is made of and how large one tile of
 * that surface is, across and along, in scene units; its darkest and palest
 * tone, which its broad patches or its boards blend between; how strongly
 * its relief bends the light, how rough it is at its roughest, and how much
 * clear finish lies over it. A top inside a room lies flat and dissolves
 * close to the lab. Open ground runs to the haze, and far from the lab
 * rolls `rise` reaches of the lab up and down.
 */
const LandSchema = Schema.Struct({
  bump: Schema.Finite,
  coat: Schema.Finite,
  dark: ToneSchema,
  indoor: Schema.Boolean,
  light: ToneSchema,
  rise: Schema.Finite,
  rough: Schema.Finite,
  surface: SurfaceSchema,
  tile: Schema.Tuple([Schema.Finite, Schema.Finite]),
});

/** How long one tile of planking is and how wide its boards lie, in metres. */
const PLANKS = [1.4, 0.11 * BOARDS] as const;

/**
 * How wide one tile of open ground lies, in metres: a stride, whatever the
 * size of the lab, so a blade of grass stays a blade beside a car as beside
 * a seedling.
 */
const OPEN = [0.6, 0.6] as const;

export const GROUNDS: Record<Ground, typeof LandSchema.Type> = {
  asphalt: {
    bump: 1,
    coat: 0,
    dark: [84, 86, 90],
    indoor: false,
    light: [122, 124, 128],
    rise: 0,
    rough: 0.92,
    surface: "asphalt",
    tile: OPEN,
  },
  concrete: {
    bump: 0.8,
    coat: 0,
    dark: [118, 118, 114],
    indoor: false,
    light: [160, 159, 154],
    rise: 0,
    rough: 0.95,
    surface: "concrete",
    tile: OPEN,
  },
  epoxy: {
    bump: 0.22,
    coat: 0.04,
    dark: [30, 31, 31],
    indoor: true,
    light: [37, 38, 37],
    rise: 0,
    rough: 0.92,
    surface: "resin",
    tile: [0.3, 0.3],
  },
  grass: {
    bump: 1.2,
    coat: 0,
    dark: [206, 212, 198],
    indoor: false,
    light: [255, 255, 250],
    rise: 0.16,
    rough: 1,
    surface: "grass",
    tile: OPEN,
  },
  maple: {
    bump: 1,
    coat: 0.35,
    dark: [196, 168, 126],
    indoor: true,
    light: [228, 204, 164],
    rise: 0,
    rough: 1,
    surface: "planks",
    tile: PLANKS,
  },
  oak: {
    bump: 1,
    coat: 0.35,
    dark: [140, 98, 60],
    indoor: true,
    light: [188, 142, 96],
    rise: 0,
    rough: 1,
    surface: "planks",
    tile: PLANKS,
  },
  sand: {
    bump: 1,
    coat: 0,
    dark: [198, 172, 122],
    indoor: false,
    light: [232, 212, 166],
    rise: 0.2,
    rough: 1,
    surface: "sand",
    tile: OPEN,
  },
  snow: {
    bump: 0.9,
    coat: 0,
    dark: [214, 226, 240],
    indoor: false,
    light: [250, 252, 254],
    rise: 0.18,
    rough: 0.9,
    surface: "snow",
    tile: OPEN,
  },
  soil: {
    bump: 1.2,
    coat: 0,
    dark: [96, 70, 48],
    indoor: false,
    light: [150, 114, 80],
    rise: 0.14,
    rough: 1,
    surface: "soil",
    tile: OPEN,
  },
  walnut: {
    bump: 1,
    coat: 0.35,
    dark: [92, 60, 40],
    indoor: true,
    light: [124, 84, 58],
    rise: 0,
    rough: 1,
    surface: "planks",
    tile: PLANKS,
  },
};

/** How many boards one sweep of a planked top holds before their tones repeat. */
const COURSES = 64;

/** How many pixels a side of the sweep of an unplanked ground has. */
const SWEEP_PIXELS = 256;

/**
 * How many tiles one sweep of an unplanked top inside a room spans: not a
 * whole number, so the sweep never lines up with the tiles under it.
 */
const SWEEP_TILES = 13.7;

/**
 * How far one sweep of open ground spans, in reaches of the lab: its patches
 * are as broad as the view is wide, where the tiles under them have long
 * blurred into one tone.
 */
const SWEEP_REACHES = 3.1;

/**
 * Paints the sweep of one ground, four bytes a pixel: the colour of the
 * whole surface at a scale far broader than its tiles, which multiplies
 * their tone. A planked top is one pixel per board, each board of its own
 * tone between the darkest and the palest of its wood, as boards sawn from
 * different trees are. Any other ground is a field of soft patches from its
 * darkest to its palest tone: broad ones, mottled by ones a few strides wide.
 * `span` is how far one sweep reaches across and along before it repeats,
 * in scene units, for a lab that reaches `reach` from its middle. Laid over
 * the tiles, the sweep keeps the eye from finding where one tile ends and
 * the next begins.
 */
export function paintSweep(kind: Ground, reach: number) {
  const { dark, indoor, light, surface, tile } = GROUNDS[kind];
  const patches = indoor
    ? ([tile[0] * SWEEP_TILES, tile[1] * SWEEP_TILES] as const)
    : ([SWEEP_REACHES * reach, SWEEP_REACHES * reach] as const);
  const planked = surface === "planks";
  const width = planked ? 1 : SWEEP_PIXELS;
  const height = planked ? COURSES : SWEEP_PIXELS;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const column = pixel % width;
    const row = Math.floor(pixel / width);
    // Broad patches a third of the sweep wide, mottled by ones a twentieth of it.
    const patch =
      0.6 * fractalAt(column / width, row / height, 3, 3, 211, 3) +
      0.4 * fractalAt(column / width, row / height, 20, 20, 213, 2);
    const pale = planked
      ? chanceAt(row, 0, 223)
      : Math.min(1, Math.max(0, 0.5 + (patch - 0.5) * 2.1));
    pixels.set(
      [
        dark[0] + (light[0] - dark[0]) * pale,
        dark[1] + (light[1] - dark[1]) * pale,
        dark[2] + (light[2] - dark[2]) * pale,
        255,
      ],
      pixel * 4
    );
  }
  return {
    height,
    pixels,
    span: planked
      ? ([tile[0], (tile[1] / BOARDS) * COURSES] as const)
      : patches,
    width,
  };
}

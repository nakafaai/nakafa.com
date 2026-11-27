import {
  chanceAt,
  fractalAt,
  ridgedAt,
} from "@repo/design-system/components/three/field/noise";
import { Array as Arr } from "effect";

/** How many broad systems of weather cross each face the sphere is read through. */
const SYSTEMS = 4;

/** How many fronts, the long curved bands along which clouds line up, cross each face. */
const FRONTS = 7;

/** How much thicker the cloud grows for each step of weather above the middle. */
const GAIN = 1.5;

/** The weather that stands for half a deck of cloud. */
const MIDDLE = 0.53;

/**
 * The storms of the middle latitudes: how many each hemisphere winds up, the
 * band of latitude they sit in, in degrees, how far each reaches, in
 * radians, the share of that reach its dense middle takes, how tightly its
 * arms wind, and how much cloud its arms and its middle add.
 */
const STORMS = {
  arms: 0.26,
  band: { from: 36, to: 58 },
  core: 0.3,
  count: 3,
  eye: 0.24,
  reach: 0.36,
  twist: 2.2,
} as const;

/** The cosine of a storm's reach: a place whose direction agrees with the storm's middle less than this is outside it. */
const NEAR = Math.cos(STORMS.reach);

/** The least a face must count toward a place for its weather to be read. */
const LEAST = 0.02;

/**
 * Where the belts of weather sit, in degrees of latitude, and how wide each
 * is: the wet belt on the equator, the storm tracks of the middle latitudes,
 * and between them the dry air under the subtropical highs.
 */
const BELTS = {
  dry: { place: 24, strength: -0.2, width: 9 },
  storm: { place: 52, strength: 0.17, width: 15 },
  wet: { place: 0, strength: 0.12, width: 8 },
} as const;

/** How much more cloud a belt of weather brings at one latitude, in degrees. */
function belt(
  latitude: number,
  { place, strength, width }: (typeof BELTS)[keyof typeof BELTS]
) {
  return strength * Math.exp(-(((Math.abs(latitude) - place) / width) ** 2));
}

/**
 * The weather read through one face of the sphere, `a` and `b` from -1 to 1:
 * broad systems pushed into swirls, with clouds lined up along curved fronts.
 */
function face(a: number, b: number, seed: number) {
  const bend = fractalAt((a + 1) / 2, (b + 1) / 2, 3, 3, seed + 40, 1) - 0.5;
  const x = (a + 1) / 2 + bend * 0.16;
  const y = (b + 1) / 2 - bend * 0.16;
  return (
    0.62 * fractalAt(x, y, SYSTEMS, SYSTEMS, seed, 3) +
    0.38 * ridgedAt(x, y, FRONTS, FRONTS, seed + 9, 2)
  );
}

/** How much a face counts toward a place, or nothing when it barely counts, so it is not read. */
function counted(weight: number) {
  return weight < LEAST ? 0 : weight;
}

/**
 * The storms one weather winds up: for each, where its middle stands, in
 * radians, and which way it turns, counterclockwise north of the equator and
 * clockwise south of it.
 *
 * @param seed - Which weather the planet has
 */
export function stormsOf(seed: number) {
  return Arr.makeBy(STORMS.count * 2, (storm) => {
    const north = storm % 2 === 0;
    const degrees =
      STORMS.band.from +
      chanceAt(storm, 1, seed) * (STORMS.band.to - STORMS.band.from);
    return {
      latitude: ((north ? degrees : -degrees) * Math.PI) / 180,
      longitude:
        ((Math.floor(storm / 2) + chanceAt(storm, 2, seed)) / STORMS.count) *
        2 *
        Math.PI,
      sense: north ? 1 : -1,
    };
  });
}

type Storm = ReturnType<typeof stormsOf>[number];

/**
 * How much cloud one storm adds over a place: a dense middle and two arms
 * that wind into it, fading to nothing at the storm's reach.
 *
 * @param latitude - Radians north of the equator
 * @param longitude - Radians east
 * @param storm - The storm
 */
export function stormAt(latitude: number, longitude: number, storm: Storm) {
  const east = longitude - storm.longitude;
  const along =
    Math.sin(storm.latitude) * Math.sin(latitude) +
    Math.cos(storm.latitude) * Math.cos(latitude) * Math.cos(east);
  if (along <= NEAR) {
    return 0;
  }
  const away = Math.acos(Math.min(1, along));
  const bearing = Math.atan2(
    Math.sin(east) * Math.cos(latitude),
    Math.cos(storm.latitude) * Math.sin(latitude) -
      Math.sin(storm.latitude) * Math.cos(latitude) * Math.cos(east)
  );
  const share = away / STORMS.reach;
  const wound =
    2 * (bearing * storm.sense - STORMS.twist * Math.log(share + STORMS.eye));
  const arms = Math.min(1, share / STORMS.eye) * (1 - share) ** 2;
  return (
    arms * (STORMS.arms * Math.cos(wound) + STORMS.arms / 2) +
    STORMS.core * Math.exp(-((share / STORMS.eye) ** 2))
  );
}

/**
 * How thick the cloud stands over one place of a planet, from 0 for clear
 * air to 1 for a full deck, changing smoothly from place to place with no
 * hard edge. The weather is read from the place's direction in space through
 * three faces and blended, so it has no seam where east meets west and no
 * pinch at the poles, and the belts of a real planet shape it: a wet
 * equator, dry subtropics, and stormy middle latitudes where a few storms
 * wind their arms. The same place and seed always answer the same cloud.
 *
 * @param latitude - Radians north of the equator, from -pi / 2 to pi / 2
 * @param longitude - Radians east, any whole turn the same
 * @param seed - Which weather the planet has
 * @param storms - The storms that weather winds up, worked out once by `stormsOf`
 */
export function cloudCover(
  latitude: number,
  longitude: number,
  seed: number,
  storms: readonly Storm[]
) {
  const level = Math.cos(latitude);
  const x = Math.cos(longitude) * level;
  const y = Math.sin(latitude);
  const z = Math.sin(longitude) * level;
  const total = x ** 4 + y ** 4 + z ** 4;
  const weightX = counted(x ** 4 / total);
  const weightY = counted(y ** 4 / total);
  const weightZ = counted(z ** 4 / total);
  const weather =
    ((weightX && face(y, z, seed) * weightX) +
      (weightY && face(z, x, seed + 11) * weightY) +
      (weightZ && face(x, y, seed + 23) * weightZ)) /
    (weightX + weightY + weightZ);
  const degrees = (latitude * 180) / Math.PI;
  const climate =
    belt(degrees, BELTS.wet) +
    belt(degrees, BELTS.storm) +
    belt(degrees, BELTS.dry);
  const turn = Math.atan2(z, x);
  const stormy = Arr.reduce(
    storms,
    0,
    (sum, storm) => sum + stormAt(latitude, turn, storm)
  );
  return Math.min(
    1,
    Math.max(0, 0.5 + (weather - MIDDLE) * GAIN + climate + stormy)
  );
}

/**
 * Paints the cloud cover of a whole planet as one image a sphere wears: one
 * byte per pixel, `width` pixels around the equator from west to east and
 * `height` rows from the south pole up to the north, each the cloud over the
 * middle of its pixel.
 *
 * @param width - Pixels around the equator
 * @param height - Rows from pole to pole
 * @param seed - Which weather the planet has
 */
export function paintClouds(width: number, height: number, seed: number) {
  const pixels = new Uint8Array(width * height);
  const storms = stormsOf(seed);
  for (let row = 0; row < height; row += 1) {
    const latitude = ((row + 0.5) / height - 0.5) * Math.PI;
    for (let column = 0; column < width; column += 1) {
      const longitude = ((column + 0.5) / width) * 2 * Math.PI;
      pixels[row * width + column] = Math.round(
        cloudCover(latitude, longitude, seed, storms) * 255
      );
    }
  }
  return pixels;
}

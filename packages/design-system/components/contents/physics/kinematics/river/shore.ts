import {
  chanceAt,
  fractalAt,
} from "@repo/design-system/components/three/field/noise";
import { Array as Arr } from "effect";

/** How far the banks reach along the river and back from it, in metres. */
export const SHORE_EXTENT = 560;

/** One tile of the banks' relief, in metres. */
const TILE = 180;

/** The places along the river where the banks are sampled: close together near the crossing. */
const ALONG = Arr.makeBy(141, (index) => {
  const place = index / 70 - 1;
  return Math.sign(place) * Math.abs(place) ** 1.7 * SHORE_EXTENT;
});

/** The share of a tile a length covers, wrapped into the tile. */
function wrap(value: number) {
  return value - Math.floor(value);
}

/** Eases from 0 to 1 as `value` crosses from `from` to `to`. */
function ease(from: number, to: number, value: number) {
  const share = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return share * share * (3 - 2 * share);
}

/**
 * How far a bank's waterline wanders from a straight line at a place along
 * the river, in metres: a few metres either way, as a natural bank does.
 *
 * @param along - The place along the river, in metres
 * @param side - Which bank: 1 or -1
 */
export function shoreAt(along: number, side: number) {
  const row = side > 0 ? 0.25 : 0.75;
  return (fractalAt(wrap(along / TILE), row, 5, 1, 31, 3) - 0.5) * 6;
}

/**
 * The height of a bank above the water, `back` metres behind its waterline:
 * the bed falls away under the water, the shore climbs a muddy slope to the
 * turf, and the meadow behind rolls gently. It is exactly the water's level
 * at the waterline.
 *
 * @param back - The distance behind the waterline, negative under the water, in metres
 * @param along - The place along the river, in metres
 */
export function bankHeight(back: number, along: number) {
  const slope = 2.5 * (ease(-4, 4, back) - 0.5);
  const meadow = 0.5 * ease(4, 16, back);
  const roll =
    (fractalAt(wrap(along / TILE), wrap(back / TILE), 9, 9, 7, 3) - 0.5) *
    1.4 *
    ease(1, 30, back);
  return slope + meadow + roll;
}

/**
 * One layer of a bank as a sheet of triangles: rows along the river, columns
 * at the given distances behind the waterline. The layer starts `sunk`
 * metres under the bank's surface at its first column and stands `lift`
 * metres over it from half a metre on, so turf laid over the shore's earth
 * ends in a lip. Texture coordinates run from 0 to 1 over the banks' whole
 * extent.
 *
 * @param side - Which bank: 1 lies toward +z, -1 toward -z
 * @param half - Half the river's width, in metres
 * @param backs - The columns' distances behind the waterline, ascending
 * @param lift - How far the layer stands over the bank's surface
 */
export function bankSheet(
  side: 1 | -1,
  half: number,
  backs: readonly number[],
  lift: number
) {
  const first = backs[0] ?? 0;
  const vertices = Arr.flatMap(ALONG, (x) => {
    const edge = half + shoreAt(x, side);
    return Arr.map(backs, (back) => ({
      position: [
        x,
        bankHeight(back, x) + lift * (2 * ease(first, first + 0.5, back) - 1),
        side * (edge + back),
      ],
      uv: [
        x / (2 * SHORE_EXTENT) + 0.5,
        (side * (edge + back)) / (2 * SHORE_EXTENT) + 0.5,
      ],
    }));
  });
  const columns = backs.length;
  const indices = Arr.flatMap(Arr.range(0, ALONG.length - 2), (row) =>
    Arr.flatMap(Arr.range(0, columns - 2), (column) => {
      const a = row * columns + column;
      const b = a + columns;
      return side > 0
        ? [a, a + 1, b, b, a + 1, b + 1]
        : [a, b, a + 1, a + 1, b, b + 1];
    })
  );
  return {
    indices,
    positions: Arr.flatMap(vertices, (vertex) => vertex.position),
    uvs: Arr.flatMap(vertices, (vertex) => vertex.uv),
  };
}

/** How many blades one clump of reeds has, and how many pieces each blade is cut into. */
const BLADES = 9;
const PIECES = 6;

/**
 * One clump of reeds as triangles, in metres, rooted at the origin: blades
 * that rise to between 1.4 and 2.4 m, each a tapering ribbon that leans
 * outward and droops toward its tip. Every vertex carries how far up its
 * blade it is, from 0 at the root to 1 at the tip, so the tips can dry out.
 */
export function reedClump() {
  const blades = Arr.makeBy(BLADES, (blade) => {
    const turn = (blade / BLADES) * Math.PI * 2 + chanceAt(blade, 1, 3) * 0.9;
    const tall = 1.4 + chanceAt(blade, 2, 3);
    const lean = 0.08 + 0.3 * chanceAt(blade, 3, 3);
    const root = 0.12 * chanceAt(blade, 4, 3);
    return Arr.flatMap(Arr.range(0, PIECES), (piece) => {
      const up = piece / PIECES;
      const out = root + tall * (lean * up + 0.35 * lean * up ** 3);
      const wide = 0.022 * (1 - up) ** 0.7 + 0.002;
      return Arr.map([-1, 1], (edge) => ({
        position: [
          Math.cos(turn) * out - edge * Math.sin(turn) * wide,
          tall * up,
          Math.sin(turn) * out + edge * Math.cos(turn) * wide,
        ],
        up,
      }));
    });
  });
  const perBlade = (PIECES + 1) * 2;
  return {
    indices: Arr.flatMap(Arr.range(0, BLADES - 1), (blade) =>
      Arr.flatMap(Arr.range(0, PIECES - 1), (piece) => {
        const a = blade * perBlade + piece * 2;
        return [a, a + 1, a + 2, a + 2, a + 1, a + 3];
      })
    ),
    positions: Arr.flatMap(Arr.flatten(blades), (vertex) => vertex.position),
    ups: Arr.map(Arr.flatten(blades), (vertex) => vertex.up),
  };
}

/**
 * Where the clumps of reeds stand along one bank: scattered in the shallows
 * and on the wet foot of the shore, thick in some stretches and absent in
 * others, each with its own size and turn.
 *
 * @param side - Which bank: 1 or -1
 * @param half - Half the river's width, in metres
 * @param count - How many places to try along the bank
 */
export function reedBeds(side: 1 | -1, half: number, count: number) {
  return Arr.flatMap(Arr.range(0, count - 1), (index) => {
    const along = (chanceAt(index, 11, side + 5) - 0.5) * 320;
    const thick = fractalAt(wrap(along / 90), 0.5, 4, 1, side + 17, 2);
    if (thick < 0.5) {
      return [];
    }
    const back = -0.9 + 2.1 * chanceAt(index, 12, side + 5);
    return [
      {
      scale: 0.7 + 0.6 * chanceAt(index, 13, side + 5),
      turn: chanceAt(index, 14, side + 5) * Math.PI * 2,
      x: along,
      y: Math.min(0, bankHeight(back, along)) - 0.05,
      z: side * (half + shoreAt(along, side) + back),
      },
    ];
  });
}

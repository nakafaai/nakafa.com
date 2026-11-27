import { chanceAt } from "@repo/design-system/components/three/field/noise";
import { Array as Arr } from "effect";

/**
 * Water hyacinth, the floating plant that drifts down tropical rivers in
 * rafts: each plant is a rosette of round, cupped leaves on swollen stalks
 * that keep it afloat. A raft is a handful of rosettes grown together. The
 * rafts ride the current, so they show the learner how fast and which way
 * the water itself moves.
 */

/** Rosettes in one raft, and leaves in one rosette. */
const ROSETTES = 6;
const LEAVES = 8;

/** How finely a stalk and a blade are cut. */
const STALK_ROWS = 4;
const STALK_SIDES = 5;
const BLADE_RINGS = 4;
const BLADE_AROUND = 10;

/** How far the rafts drift before they start again upstream, in river widths. */
const REACH = 6;

/** How far upstream of the crossing the rafts start, in river widths. */
const UPSTREAM = 2.4;

/** The share of a length that is left after whole lengths are taken away. */
function wrap(value: number) {
  return value - Math.floor(value);
}

/**
 * A sheet of vertices laid out as rows and columns, each placed by `at` from
 * its share along the rows and along the columns, with the triangles that
 * join neighbours, numbered from `first`.
 */
function sheet(
  rows: number,
  columns: number,
  first: number,
  at: (along: number, around: number) => readonly number[]
) {
  return {
    indices: Arr.flatMap(Arr.range(0, rows - 1), (row) =>
      Arr.flatMap(Arr.range(0, columns - 1), (column) => {
        const a = first + row * (columns + 1) + column;
        const b = a + columns + 1;
        return [a, b, a + 1, a + 1, b, b + 1];
      })
    ),
    vertices: Arr.flatMap(Arr.range(0, rows), (row) =>
      Arr.map(Arr.range(0, columns), (column) =>
        at(row / rows, column / columns)
      )
    ),
  };
}

/**
 * One leaf of a rosette rooted at (`x`, `z`) on the water: a stalk that
 * leans outward and swells into a float halfway up, and a round blade
 * cupped toward the light at its tip. Every vertex is its place followed by
 * how leafy it is, from 0 at the pale foot of the stalk to 1 on the blade.
 */
function leaf(x: number, z: number, seed: number, first: number) {
  const turn = chanceAt(seed, 1, 41) * Math.PI * 2;
  const out = 0.1 + 0.14 * chanceAt(seed, 2, 41);
  const tall = 0.08 + 0.16 * chanceAt(seed, 3, 41);
  const broad = 0.065 + 0.04 * chanceAt(seed, 4, 41);
  const tilt = 0.35 + 0.5 * chanceAt(seed, 5, 41);
  const along = [Math.cos(turn), Math.sin(turn)] as const;
  const stalk = sheet(STALK_ROWS, STALK_SIDES, first, (up, around) => {
    const thick = 0.009 + 0.017 * Math.sin(Math.PI * up) ** 2;
    const angle = around * Math.PI * 2;
    const reach = out * up ** 1.5 + Math.cos(angle) * thick;
    return [
      x + along[0] * reach - along[1] * Math.sin(angle) * thick,
      tall * up ** 0.7 - 0.02,
      z + along[1] * reach + along[0] * Math.sin(angle) * thick,
      0.45 * up,
    ];
  });
  const blade = sheet(
    BLADE_RINGS,
    BLADE_AROUND,
    first + stalk.vertices.length,
    (ring, around) => {
      const angle = around * Math.PI * 2;
      const radius = broad * ring * (1 - 0.16 * Math.cos(angle));
      const flat = Math.cos(angle) * radius;
      const cup = 0.22 * broad * ring * ring;
      const reach = out + flat * Math.cos(tilt) - cup * Math.sin(tilt);
      const side = Math.sin(angle) * radius;
      return [
        x + along[0] * reach - along[1] * side,
        tall - 0.02 + flat * Math.sin(tilt) + cup * Math.cos(tilt),
        z + along[1] * reach + along[0] * side,
        1 - 0.25 * ring * chanceAt(seed, around * 20, 43),
      ];
    }
  );
  return {
    indices: Arr.appendAll(stalk.indices, blade.indices),
    vertices: Arr.appendAll(stalk.vertices, blade.vertices),
  };
}

/**
 * One raft of water hyacinth as triangles, in metres, floating on water at
 * height zero and about two metres across: six rosettes of eight leaves.
 * `shades` says how leafy each vertex is, from 0 for the pale foot of a
 * stalk to 1 for the green of a blade.
 */
export function hyacinthRaft() {
  const leaves = Arr.reduce(
    Arr.range(0, ROSETTES * LEAVES - 1),
    { indices: Arr.empty<number>(), vertices: Arr.empty<readonly number[]>() },
    (built, index) => {
      const rosette = Math.floor(index / LEAVES);
      const around = (rosette / (ROSETTES - 1)) * Math.PI * 2;
      const far = rosette === 0 ? 0 : 0.42 + 0.3 * chanceAt(rosette, 6, 41);
      const next = leaf(
        Math.cos(around) * far,
        Math.sin(around) * far,
        index + 1,
        built.vertices.length
      );
      return {
        indices: Arr.appendAll(built.indices, next.indices),
        vertices: Arr.appendAll(built.vertices, next.vertices),
      };
    }
  );
  return {
    indices: leaves.indices,
    positions: Arr.flatMap(leaves.vertices, (vertex) => Arr.take(vertex, 3)),
    shades: Arr.flatMap(leaves.vertices, (vertex) => Arr.drop(vertex, 3)),
  };
}

/**
 * Where each raft floats across a river and how it lies: its lane from bank
 * to bank, clear of the shallows, how far along its drift it starts, its
 * size, and how fast it slowly turns.
 *
 * @param width - The river's width, in metres
 * @param count - How many rafts drift on it
 */
export function raftLanes(width: number, count: number) {
  return Arr.makeBy(count, (index) => ({
    scale: 0.6 + 0.9 * chanceAt(index, 1, 47),
    spin: (chanceAt(index, 2, 47) - 0.5) * 0.16,
    start: chanceAt(index, 3, 47),
    z: (chanceAt(index, 4, 47) - 0.5) * (width - 6),
  }));
}

/**
 * Where a raft is along the river at a moment, in metres from the crossing,
 * positive downstream: it rides the current, and once it has drifted the
 * whole reach it starts again upstream, out of sight.
 *
 * @param start - The share of the reach the raft starts at
 * @param time - The water's time, in seconds
 * @param current - The speed of the current, in m/s
 * @param width - The river's width, in metres
 */
export function raftAlong(
  start: number,
  time: number,
  current: number,
  width: number
) {
  const reach = REACH * width;
  return (wrap(start + (current * time) / reach) - UPSTREAM / REACH) * reach;
}

/**
 * How much of a raft shows at a place along the river, from 0 to 1: it
 * grows in as it enters the reach upstream and sinks away at its far end,
 * so no raft ever appears or vanishes in view.
 *
 * @param along - The raft's place along the river, in metres from the crossing
 * @param width - The river's width, in metres
 */
export function raftShown(along: number, width: number) {
  const share = along / (REACH * width) + UPSTREAM / REACH;
  return Math.min(1, share / 0.05, (1 - share) / 0.05);
}

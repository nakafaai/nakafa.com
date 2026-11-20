import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr } from "effect";
import { KIND, LOOK } from "@/lib/island/look";
import { smoothOf, unitOf } from "@/lib/island/noise";
import type { Cells } from "@/lib/island/world";
import { blockAt, cellOf, SEA_LEVEL } from "@/lib/island/world";

const WATER = idOf("water");
const SAND = idOf("sand");
const STONE = idOf("stone");
const LOG = idOf("log");
const LEAVES = idOf("leaves");

/** The middle of the world, where every island is centered. */
const MIDDLE = SPAN / 2;

/**
 * The home island's highland (ADR 0047, D52): a massif on the side away from
 * its pond, `reach` radians either side of its bearing. It pushes the shore
 * out by up to `bulge` cells into a headland and climbs from the meadow's rim
 * in whole terraces to `peak` blocks over the sea, falling to the sea in a
 * cliff, so the island has its highlands and lowlands.
 */
const HIGHLAND = { bulge: 6, peak: 9, reach: 0.95 } as const;

/** How high a top must stand over the sea to show bare stone instead of grass. */
export const ROCK = 6;

/** The longest a stream runs, in columns, from its spring to the sea. */
const LONGEST = 48;

/** The way the home island's pond lies from the middle, in radians, as its seed picks it (D23). */
export function pondBearing(seed: number) {
  return (0.1 + unitOf(seed + 12, 0, 0, 0) * 0.8) * Math.PI;
}

/** The way (x, z) lies from the middle, in the pond bearing's own sense. */
function bearingOf(x: number, z: number) {
  return Math.atan2(-(z + 0.5 - MIDDLE), x + 0.5 - MIDDLE);
}

/** The shortest turn between two bearings, from 0 to pi. */
function turnBetween(a: number, b: number) {
  const turn = Math.abs(a - b) % (Math.PI * 2);
  return turn > Math.PI ? Math.PI * 2 - turn : turn;
}

/**
 * How much of the highland stands at (x, z), from 0 off its side of the island
 * to 1 on its bearing, easing away to either side so its flanks fall gently.
 */
export function highlandOf(seed: number, x: number, z: number) {
  const off = turnBetween(bearingOf(x, z), pondBearing(seed) + Math.PI);
  if (off >= HIGHLAND.reach) {
    return 0;
  }
  return 0.5 + 0.5 * Math.cos((Math.PI * off) / HIGHLAND.reach);
}

/** How far the highland pushes the shore out at a column of this weight, in cells. */
export function bulgeOf(weight: number) {
  return HIGHLAND.bulge * weight;
}

/**
 * How many blocks over the sea the highland stands at a column `distance`
 * cells from the middle, between the meadow's rim `from` and the shore
 * `edge`: a ridge whose crest stands midway, falling inland to the meadow
 * and seaward to a cliff half its height, roughened by a slow noise so its
 * slopes are never one ramp, in whole terraces two blocks high so each step
 * down is a fall for the stream.
 */
export function riseOf(
  seed: number,
  x: number,
  z: number,
  weight: number,
  distance: number,
  [from, edge]: readonly [number, number]
) {
  const span = edge - from;
  if (weight === 0 || span <= 0) {
    return 0;
  }
  const share = Math.min(1, Math.max(0, (distance - from) / span));
  const profile = Math.max(Math.sin(Math.PI * share), 0.5 * share);
  const rough = 0.8 + 0.4 * smoothOf(seed + 60, x, z, 4);
  return 2 * Math.floor((HIGHLAND.peak * weight * profile * rough) / 2);
}

/** Whether a block is ground or water a stream runs over: no plant, no log and no leaf of a tree. */
function isGround(block: number) {
  const kind = LOOK.kinds[block];
  return (
    (kind === KIND.solid && block !== LOG && block !== LEAVES) ||
    kind === KIND.liquid
  );
}

/** The top cell of the ground in a column, past any tree or plant standing on it, -1 where it holds nothing. */
function topOf(cells: Cells, x: number, z: number) {
  for (let y = SEA_LEVEL + HIGHLAND.peak + 2; y >= 0; y -= 1) {
    if (isGround(blockAt(cells, x, y, z))) {
      return y;
    }
  }
  return -1;
}

/** Whether a column is land: its ground stands at or over the sea and holds no water. */
function isLand(cells: Cells, x: number, z: number) {
  const top = topOf(cells, x, z);
  return top >= SEA_LEVEL && blockAt(cells, x, top, z) !== WATER;
}

/** The four columns beside a column, across and deep. */
const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * How many steps each land column lies from water it could run into, the
 * sea or the pond, through land: the way the stream finds its mouth once
 * the ground runs level.
 */
function mouthsOf(cells: Cells) {
  const steps = new Int16Array(SPAN * SPAN).fill(-1);
  // Each column enters the queue once, so a queue as long as the world holds every one.
  const queue = new Int32Array(SPAN * SPAN);
  let length = 0;
  for (let index = 0; index < SPAN * SPAN; index += 1) {
    if (!isLand(cells, index % SPAN, Math.floor(index / SPAN))) {
      steps[index] = 0;
      queue[length] = index;
      length += 1;
    }
  }
  for (let read = 0; read < length; read += 1) {
    const index = queue[read];
    const [x, z] = [index % SPAN, Math.floor(index / SPAN)];
    for (const [dx, dz] of SIDES) {
      const [nx, nz] = [x + dx, z + dz];
      const next = nz * SPAN + nx;
      const inside = nx >= 0 && nx < SPAN && nz >= 0 && nz < SPAN;
      if (inside && steps[next] < 0) {
        steps[next] = steps[index] + 1;
        queue[length] = next;
        length += 1;
      }
    }
  }
  return steps;
}

/** Fills a column with water from `from` up to `to`, the fall a stream pours down where its bed drops. */
function pour(cells: Cells, x: number, z: number, from: number, to: number) {
  for (let y = from; y <= to; y += 1) {
    cells[cellOf(x, y, z)] = WATER;
  }
}

/**
 * The stream of the highland (D52): it rises in a tarn on the highest
 * terrace and runs down the massif, each step taking the lowest column
 * beside it, out toward the sea where the ground is level, until it reaches
 * the sea or still water from the lowland. Its bed is sand, each drop of its
 * bed is a fall of water, it keeps clear of the village, and no tree or
 * flower grows in it, so `meadows` loses each column it takes. It answers
 * the columns it took, from its spring to its mouth.
 */
export function layStream(cells: Cells, meadows: Int8Array, seed: number) {
  const spring = springOf(cells, seed);
  if (spring === undefined) {
    return [];
  }
  const visited = new Uint8Array(SPAN * SPAN);
  const mouths = mouthsOf(cells);
  let taken: readonly (readonly [number, number])[] = [];
  let [x, z] = spring;
  let top = topOf(cells, x, z);
  layTarn(cells, meadows, x, top, z);
  for (let step = 0; step < LONGEST; step += 1) {
    taken = Arr.append(taken, [x, z] as const);
    visited[z * SPAN + x] = 1;
    cells[cellOf(x, top, z)] = WATER;
    cells[cellOf(x, top - 1, z)] = SAND;
    meadows[z * SPAN + x] = -1;
    const next = nextOf(cells, { mouths, visited }, seed, [x, top, z], step);
    if (next === undefined) {
      break;
    }
    const [nx, nz] = next;
    if (!isLand(cells, nx, nz)) {
      // Its mouth: from the level lowland it runs out into the sea or the pond; from a cliff it falls into the sea.
      if (top > SEA_LEVEL) {
        pour(cells, nx, nz, SEA_LEVEL, top);
      }
      taken = Arr.append(taken, [nx, nz] as const);
      break;
    }
    const below = topOf(cells, nx, nz);
    if (below < top) {
      pour(cells, nx, nz, below, top);
    }
    [x, z, top] = [nx, nz, below];
  }
  return taken;
}

/** Where the stream rises: the highest column of the highland, none on an island too small to lift one. */
function springOf(cells: Cells, seed: number) {
  let best: readonly [number, number] | undefined;
  let height = SEA_LEVEL + 3;
  for (let z = 1; z < SPAN - 1; z += 1) {
    for (let x = 1; x < SPAN - 1; x += 1) {
      const top = topOf(cells, x, z);
      if (highlandOf(seed, x, z) > 0.7 && top > height && isLand(cells, x, z)) {
        [best, height] = [[x, z], top];
      }
    }
  }
  return best;
}

/** A small tarn round the spring: water in every column beside it on the same terrace that no tree stands on. */
function layTarn(
  cells: Cells,
  meadows: Int8Array,
  x: number,
  top: number,
  z: number
) {
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (
        topOf(cells, x + dx, z + dz) === top &&
        blockAt(cells, x + dx, top, z + dz) !== WATER &&
        blockAt(cells, x + dx, top + 1, z + dz) !== LOG
      ) {
        cells[cellOf(x + dx, top, z + dz)] = WATER;
        cells[cellOf(x + dx, top - 1, z + dz)] = STONE;
        meadows[(z + dz) * SPAN + x + dx] = -1;
      }
    }
  }
}

/** How near the middle the stream may run: it keeps three cells clear of the village. */
const CLEAR = 17;

/** How many columns the stream runs at least before it may fall from a cliff into the sea, so it shows as a stream first. */
const RUN = 10;

/**
 * The stream's next column from (x, top, z): of the columns beside it that
 * it has not run through, inside the world and clear of the village, the
 * lowest that lies no higher than it and no tree stands on, and of level ones
 * the nearest its mouth, a seeded roll breaking ties so it meanders. Water
 * beside it is its mouth: taken from the level lowland at once, and from
 * higher ground once it has run `RUN` columns or found nowhere else to go,
 * falling from the cliff. None when nowhere lies lower or level.
 */
function nextOf(
  cells: Cells,
  { mouths, visited }: { mouths: Int16Array; visited: Uint8Array },
  seed: number,
  [x, top, z]: readonly [number, number, number],
  step: number
) {
  let best: readonly [number, number] | undefined;
  let water: readonly [number, number] | undefined;
  let lowest = Number.POSITIVE_INFINITY;
  for (const [dx, dz] of SIDES) {
    const [nx, nz] = [x + dx, z + dz];
    const away = Math.hypot(nx + 0.5 - MIDDLE, nz + 0.5 - MIDDLE);
    const index = nz * SPAN + nx;
    const inside = nx > 0 && nx < SPAN - 1 && nz > 0 && nz < SPAN - 1;
    if (inside && away >= CLEAR && visited[index] === 0) {
      const height = topOf(cells, nx, nz);
      // A stream runs round a tree's trunk, never under it.
      const clear = blockAt(cells, nx, height + 1, nz) !== LOG;
      const score =
        height * 4 + mouths[index] + unitOf(seed + 61, step, dx, dz) * 0.5;
      if (!isLand(cells, nx, nz)) {
        water = [nx, nz];
      } else if (height <= top && clear && score < lowest) {
        [best, lowest] = [[nx, nz], score];
      }
    }
  }
  const mouth = top === SEA_LEVEL || step >= RUN || best === undefined;
  return water !== undefined && mouth ? water : best;
}

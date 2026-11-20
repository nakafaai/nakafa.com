import { Array as Arr, Match, Option } from "effect";
import type { Blocker, Standing } from "@/lib/island/collide";
import { blocksAt, deckAt, groundAt } from "@/lib/island/collide";
import { heapOf } from "@/lib/island/heap";
import type { Land } from "@/lib/island/land/ground";
import { depthAt } from "@/lib/island/land/ground";
import type { Drive } from "@/lib/island/walker";
import { CLIMB, DROP, gradientOf, PACE, REST, SWIM } from "@/lib/island/walker";

/** How far the fox is sent in one go, in blocks: about 80 m; a press farther off finds no way. */
export const REACH = 90;

/** How many lattice points a search looks at before it gives up, so a press no way leads to answers at once. */
const LIMIT = 4000;

/** How far past the fox and the pressed place the search may go around something, in blocks. */
const PAD = 14;

/** How close to something that stands on the land a route's line may pass, in blocks: just inside the fox's own half width, which it slides by with. */
const ROOM = 0.3;

/**
 * What ground a route keeps off, a little inside what the walker itself
 * refuses, so it never plans a step the fox cannot take: ground steeper than
 * `climb` wherever the way rises by more than `level` blocks a block, and
 * ground steeper than `drop` wherever it falls by more.
 */
const STEEP = { climb: CLIMB - 0.05, drop: DROP - 0.2, level: 0.05 } as const;

/**
 * What a block of the way costs beyond its length: water the fox swims and
 * water it wades, deeper than `wet` blocks, cost more, and each block of rise
 * or fall over a block makes the way that much longer again.
 */
const COST = { hill: 1.6, swim: 2.2, wade: 0.4, wet: 0.03 } as const;

/** How far apart a straight line is checked when a route is drawn tight, in blocks, and how many points ahead it looks for a shortcut. */
const LINE = { ahead: 40, apart: 0.5 } as const;

/**
 * How the fox walks a route: a place within `near` blocks counts as reached;
 * it runs while more than `far` blocks of the way are left, walks the rest,
 * and over the last `close` blocks it slows toward `least` blocks a second,
 * so it arrives instead of overshooting.
 */
const WALK = { close: PACE.walk / 2, far: 24, least: 1.4, near: 0.35 } as const;

/** The eight ways from a lattice point to its neighbours. */
const WAYS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/** Whether the ground refuses a way that rises `rate` blocks a block over ground of a steepness: up ground too steep to climb, or down a cliff. */
function refuses(rate: number, slope: number) {
  return (
    (slope > STEEP.climb && rate > STEEP.level) ||
    (slope > STEEP.drop && rate < -STEEP.level)
  );
}

/** The window of lattice points a search may visit: the fox and the pressed place with room around them. */
function gridOf(
  from: readonly [number, number],
  to: readonly [number, number]
) {
  const wide = Math.ceil(Math.abs(to[0] - from[0])) + PAD * 2 + 2;
  const deep = Math.ceil(Math.abs(to[1] - from[1])) + PAD * 2 + 2;
  return {
    deep,
    size: wide * deep,
    wide,
    x0: Math.floor(Math.min(from[0], to[0])) - PAD,
    z0: Math.floor(Math.min(from[1], to[1])) - PAD,
  };
}

/** The lattice point of a window nearest a place. */
function nodeOf(
  grid: ReturnType<typeof gridOf>,
  place: readonly [number, number]
) {
  return (
    (Math.round(place[1]) - grid.z0) * grid.wide +
    (Math.round(place[0]) - grid.x0)
  );
}

/** Where a lattice point of a window lies in the world. */
function placeOf(grid: ReturnType<typeof gridOf>, node: number) {
  return [
    grid.x0 + (node % grid.wide),
    grid.z0 + Math.floor(node / grid.wide),
  ] as const;
}

/** Which lattice points of a window something stands on, 1 for each. */
function maskOf(grid: ReturnType<typeof gridOf>, blockers: readonly Blocker[]) {
  const mask = new Uint8Array(grid.size);
  for (const blocker of blockers) {
    const [wide, deep] = Match.valueTags(blocker, {
      box: (found) => [found.wide + ROOM, found.deep + ROOM] as const,
      round: (found) => [found.radius + ROOM, found.radius + ROOM] as const,
    });
    const rows = [
      Math.max(0, Math.ceil(blocker.z - deep - grid.z0)),
      Math.min(grid.deep - 1, Math.floor(blocker.z + deep - grid.z0)),
    ] as const;
    const columns = [
      Math.max(0, Math.ceil(blocker.x - wide - grid.x0)),
      Math.min(grid.wide - 1, Math.floor(blocker.x + wide - grid.x0)),
    ] as const;
    for (let row = rows[0]; row <= rows[1]; row += 1) {
      for (let column = columns[0]; column <= columns[1]; column += 1) {
        if (blocksAt([blocker], grid.x0 + column, grid.z0 + row, ROOM)) {
          mask[row * grid.wide + column] = 1;
        }
      }
    }
  }
  return mask;
}

/** What a block of the way over a place costs, before its slope: more through water it wades, more again through water it swims. */
function costAt(land: Land, standing: Standing, x: number, z: number) {
  if (Option.isSome(deckAt(standing.decks, x, z))) {
    return 1;
  }
  const depth = depthAt(land, x, z);
  if (depth > SWIM) {
    return 1 + COST.swim;
  }
  return depth > COST.wet ? 1 + COST.wade : 1;
}

/**
 * The land of a window as a search reads it: the height and the cost of each
 * lattice point, read the first time the search reaches it, and whether
 * something stands on it.
 */
function fieldOf(
  land: Land,
  standing: Standing,
  grid: ReturnType<typeof gridOf>,
  start: number
) {
  const mask = maskOf(grid, standing.blockers);
  // The fox may stand in something when it sets off; a step out of it is never refused.
  mask[start] = 0;
  const heights = new Float32Array(grid.size).fill(Number.NaN);
  const costs = new Float32Array(grid.size);
  /** The height of a lattice point by its column and row, the window's own edge standing in for what lies past it. */
  const height = (column: number, row: number) => {
    const node =
      Math.min(grid.deep - 1, Math.max(0, row)) * grid.wide +
      Math.min(grid.wide - 1, Math.max(0, column));
    if (Number.isNaN(heights[node])) {
      const [x, z] = placeOf(grid, node);
      heights[node] = groundAt(land, standing.decks, x, z);
      costs[node] = costAt(land, standing, x, z);
    }
    return heights[node];
  };
  /** How steep the ground is midway along a step, whichever way it faces: the slope of the cell a diagonal step crosses, or of the edge a straight one follows. */
  const slope = (x: number, z: number, dx: number, dz: number) => {
    const [from, to] = [height(x, z), height(x + dx, z + dz)];
    if (dx !== 0 && dz !== 0) {
      const [beside, ahead] = [height(x + dx, z), height(x, z + dz)];
      return Math.hypot(
        (beside - from + to - ahead) / 2,
        (ahead - from + to - beside) / 2
      );
    }
    const [px, pz] = dx === 0 ? [1, 0] : [0, 1];
    const side =
      (height(x + px, z + pz) -
        height(x - px, z - pz) +
        height(x + dx + px, z + dz + pz) -
        height(x + dx - px, z + dz - pz)) /
      4;
    return Math.hypot(to - from, side);
  };
  return {
    blocked: (node: number) => mask[node] === 1,
    /** What the step from a lattice point to a neighbour costs, infinite where the ground between them is too steep for the way it goes. */
    cost: (x: number, z: number, dx: number, dz: number) => {
      const length = Math.hypot(dx, dz);
      const rate = (height(x + dx, z + dz) - height(x, z)) / length;
      return refuses(rate, slope(x, z, dx, dz))
        ? Number.POSITIVE_INFINITY
        : length *
            costs[(z + dz) * grid.wide + x + dx] *
            (1 + Math.abs(rate) * COST.hill);
    },
  };
}

/**
 * The cheapest way over a window's lattice from one point to another, as the
 * point each point was reached from, none when no way leads there within the
 * search's limit. A step never enters a point something stands on, never
 * cuts the corner of one, and never takes ground too steep.
 */
function searched(
  grid: ReturnType<typeof gridOf>,
  field: ReturnType<typeof fieldOf>,
  start: number,
  goal: number
) {
  const before = new Int32Array(grid.size).fill(-1);
  const spent = new Float32Array(grid.size).fill(Number.POSITIVE_INFINITY);
  const closed = new Uint8Array(grid.size);
  const heap = heapOf(LIMIT * WAYS.length + 1);
  const [goalX, goalZ] = [goal % grid.wide, Math.floor(goal / grid.wide)];
  spent[start] = 0;
  heap.push(start, 0);
  let looked = 0;
  while (heap.size() > 0 && looked < LIMIT) {
    const node = heap.pop();
    if (node === goal) {
      return Option.some(before);
    }
    if (closed[node] === 0) {
      closed[node] = 1;
      looked += 1;
      const [x, z] = [node % grid.wide, Math.floor(node / grid.wide)];
      for (const [dx, dz] of WAYS) {
        const [nx, nz] = [x + dx, z + dz];
        const next = nz * grid.wide + nx;
        const open =
          nx >= 0 &&
          nz >= 0 &&
          nx < grid.wide &&
          nz < grid.deep &&
          closed[next] === 0 &&
          !field.blocked(next) &&
          !field.blocked(z * grid.wide + nx) &&
          !field.blocked(nz * grid.wide + x);
        const total = open
          ? spent[node] + field.cost(x, z, dx, dz)
          : Number.POSITIVE_INFINITY;
        if (total < spent[next]) {
          spent[next] = total;
          before[next] = node;
          heap.push(next, total + Math.hypot(nx - goalX, nz - goalZ));
        }
      }
    }
  }
  return Option.none();
}

/** Whether the fox can walk the straight line between two places: clear of everything that stands, never over ground too steep for the way it goes, and without entering or leaving water it swims. */
function clearLine(
  land: Land,
  standing: Standing,
  from: readonly [number, number],
  to: readonly [number, number]
) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const parts = Math.max(1, Math.ceil(length / LINE.apart));
  const ground = (x: number, z: number) => groundAt(land, standing.decks, x, z);
  const swims = (x: number, z: number) =>
    Option.isNone(deckAt(standing.decks, x, z)) && depthAt(land, x, z) > SWIM;
  // Only what stands beside the line can stand in it.
  const beside = Arr.filter(standing.blockers, (blocker) =>
    blocksAt(
      [blocker],
      (from[0] + to[0]) / 2,
      (from[1] + to[1]) / 2,
      length / 2 + ROOM
    )
  );
  const swam = swims(from[0], from[1]);
  let height = ground(from[0], from[1]);
  for (let part = 1; part <= parts; part += 1) {
    const x = from[0] + ((to[0] - from[0]) * part) / parts;
    const z = from[1] + ((to[1] - from[1]) * part) / parts;
    const next = ground(x, z);
    const rate = ((next - height) * parts) / Math.max(length, 1e-6);
    const steep =
      Math.abs(rate) > STEEP.level &&
      refuses(rate, Math.hypot(...gradientOf(ground, x, z)));
    if (steep || swims(x, z) !== swam || blocksAt(beside, x, z, ROOM)) {
      return false;
    }
    height = next;
  }
  return true;
}

/** A way drawn tight: from each point it keeps, a point far ahead that the fox can walk straight to, found in a few tries. */
function tightened(
  land: Land,
  standing: Standing,
  points: readonly (readonly [number, number])[]
) {
  let kept: readonly (readonly [number, number])[] = [];
  let at = 0;
  while (at < points.length - 1) {
    const from = points[at];
    const clear = (index: number) =>
      clearLine(land, standing, from, points[index]);
    let near = at + 1;
    let far = Math.min(points.length - 1, at + LINE.ahead);
    if (clear(far)) {
      near = far;
    }
    while (far - near > 1) {
      const middle = Math.floor((near + far) / 2);
      if (clear(middle)) {
        near = middle;
      } else {
        far = middle;
      }
    }
    kept = Arr.append(kept, points[near]);
    at = near;
  }
  return kept;
}

/**
 * The way the fox walks from where it stands to a pressed place (ADR 0047,
 * D12; ADR 0050, W1), as a short list of places to head for one after
 * another, the last of them the pressed place. It is the cheapest way over
 * the land's lattice: longer uphill and through water, never through what
 * stands on the land and never over ground too steep. None when the place is
 * farther than the fox is sent in one go, when something stands on it, or
 * when no way leads there.
 */
export function routeOf(
  land: Land,
  standing: Standing,
  from: readonly [number, number],
  to: readonly [number, number]
) {
  if (Math.hypot(to[0] - from[0], to[1] - from[1]) > REACH) {
    return Option.none();
  }
  const grid = gridOf(from, to);
  const start = nodeOf(grid, from);
  const goal = nodeOf(grid, to);
  const field = fieldOf(land, standing, grid, start);
  if (field.blocked(goal)) {
    return Option.none();
  }
  return Option.map(searched(grid, field, start, goal), (before) => {
    const nodes = Arr.reverse(
      Arr.unfold(goal, (node) =>
        node === -1
          ? Option.none()
          : Option.some([placeOf(grid, node), before[node]] as const)
      )
    );
    const end = blocksAt(standing.blockers, to[0], to[1], ROOM)
      ? placeOf(grid, goal)
      : to;
    return tightened(land, standing, [
      from,
      ...Arr.drop(Arr.dropRight(nodes, 1), 1),
      end,
    ]);
  });
}

/** How long the way through places is, from a place to the last of them, in blocks. */
function lengthOf(
  from: readonly [number, number],
  places: readonly (readonly [number, number])[]
) {
  return Arr.reduce(places, { at: from, total: 0 }, (so, place) => ({
    at: place,
    total: so.total + Math.hypot(place[0] - so.at[0], place[1] - so.at[1]),
  })).total;
}

/**
 * How the fox at a place follows a route: the places still ahead of it, the
 * ones it reached left out, and the drive toward the next, running while the
 * way is long and slowing as it ends. A route with nothing left asks for
 * nothing.
 */
export function followed(
  route: readonly (readonly [number, number])[],
  x: number,
  z: number
) {
  const ahead = Arr.dropWhile(
    route,
    (place) => Math.hypot(place[0] - x, place[1] - z) < WALK.near
  );
  return Option.match(Arr.head(ahead), {
    onNone: () => ({ drive: REST, route: ahead }),
    onSome: (next) => {
      const left = lengthOf([x, z], ahead);
      const near = Math.hypot(next[0] - x, next[1] - z);
      const walk =
        left > WALK.close ? PACE.walk : Math.max(WALK.least, left * 2);
      const drive: Drive = {
        speed: left > WALK.far ? PACE.run : walk,
        x: (next[0] - x) / near,
        z: (next[1] - z) / near,
      };
      return { drive, route: ahead };
    },
  });
}

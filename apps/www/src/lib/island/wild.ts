import { idOf } from "@repo/backend/confect/island/blocks";
import { footprintOf, SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option, Order, Result, Schema } from "effect";
import { NO_SHADOW } from "@/lib/island/bodies";
import { SPECIES } from "@/lib/island/fauna/species";
import { groundOf } from "@/lib/island/life";
import { KIND, LOOK } from "@/lib/island/look";
import { schoolOf } from "@/lib/island/models/ocean";
import { unitOf } from "@/lib/island/noise";
import { shoreOf } from "@/lib/island/terrain";
import { blockAt, type Cells, SEA_LEVEL } from "@/lib/island/world";

/** How many of each home's species a day brings to the island. */
const VISITORS = { bloom: 4, land: 6, sea: 6, shore: 3, sky: 5 } as const;

/** The ground each walking home stands on. */
const GROUNDS = {
  land: [idOf("grass"), idOf("dirt")],
  shore: [idOf("sand")],
} as const;

/**
 * One wild creature on the island today (ADR 0047, D11): which species it is,
 * where it stands and where it is going (walkers), its place along its loop
 * (flyers and swimmers), how many steps it has taken and how long it rests.
 */
const Wild = Schema.Struct({
  index: Schema.Int,
  phase: Schema.Finite,
  rest: Schema.Finite,
  steps: Schema.Int,
  tx: Schema.Finite,
  tz: Schema.Finite,
  x: Schema.Finite,
  z: Schema.Finite,
});
type Wild = typeof Wild.Type;

/** Whether a walker of this home can stand in a column. */
function standsOn(cells: Cells, home: "land" | "shore", x: number, z: number) {
  return Option.exists(
    groundOf(cells, Math.floor(x), Math.floor(z)),
    ({ block }) => Arr.contains(GROUNDS[home], block)
  );
}

/**
 * The wild creatures of one day on one island: a few species of each home,
 * picked from the whole catalog by the island's seed and the day, so the
 * island is visited by different animals as the days go by. Walkers start on
 * their own ground; flyers and swimmers start somewhere along their loops.
 */
export function wildOf(cells: Cells, seed: number, size: number, day: number) {
  const footprint = footprintOf(size);
  const every = Arr.flatMap(
    Arr.makeBy(size, (dz) => footprint.from + dz),
    (z) =>
      Arr.map(
        Arr.makeBy(size, (dx) => footprint.from + dx),
        (x) => ({ x, z })
      )
  );
  const columns = Arr.sort(
    every,
    Order.mapInput(Order.Number, (column: (typeof every)[number]) =>
      unitOf(seed + day, column.x, 3, column.z)
    )
  );
  const catalog = Arr.map(SPECIES, (species, index) => ({
    home: species.home,
    index,
  }));
  return Arr.flatMap(
    ["land", "shore", "sky", "sea", "bloom"] as const,
    (home) => {
      const kinds = Arr.take(
        Arr.sort(
          Arr.filter(catalog, (entry) => entry.home === home),
          Order.mapInput(Order.Number, (entry: (typeof catalog)[number]) =>
            unitOf(seed + day * 7, entry.index, 5, 0)
          )
        ),
        VISITORS[home]
      );
      const spots =
        home === "land" || home === "shore"
          ? Arr.filter(columns, ({ x, z }) =>
              standsOn(cells, home, x + 0.5, z + 0.5)
            )
          : columns;
      return Arr.map(
        Arr.zip(kinds, Arr.take(spots, kinds.length)),
        ([{ index }, { x, z }], order) => ({
          index,
          // Sea visitors share one loop, so they keep evenly apart on it and never swim through each other.
          phase:
            home === "sea"
              ? ((order + unitOf(seed, day, 9, 0) / 2) / kinds.length) *
                Math.PI *
                2
              : unitOf(seed, index, day, 9) * Math.PI * 2,
          rest: 0,
          steps: 0,
          tx: x + 0.5,
          tz: z + 0.5,
          x: x + 0.5,
          z: z + 0.5,
        })
      );
    }
  );
}

/** One wild creature after `dt` seconds: a walker rests, walks toward its goal, or picks a new one on its own ground. */
export function roam(cells: Cells, wild: Wild, seed: number, dt: number): Wild {
  const home = SPECIES[wild.index].home;
  if (home !== "land" && home !== "shore") {
    return wild;
  }
  if (wild.rest > 0) {
    return { ...wild, rest: Math.max(0, wild.rest - dt) };
  }
  const dx = wild.tx - wild.x;
  const dz = wild.tz - wild.z;
  const distance = Math.hypot(dx, dz);
  const reach = Math.min(1.6, 0.4 + SPECIES[wild.index].height) * dt;
  if (distance > reach) {
    const next = {
      x: wild.x + (dx / distance) * reach,
      z: wild.z + (dz / distance) * reach,
    };
    // A walker never climbs a step or crosses a wall on its way: it stops there and rests (ADR 0047, D25).
    const level = (x: number, z: number) =>
      Option.map(groundOf(cells, Math.floor(x), Math.floor(z)), ({ y }) => y);
    const open =
      standsOn(cells, home, next.x, next.z) &&
      Option.exists(level(next.x, next.z), (ahead) =>
        Option.exists(level(wild.x, wild.z), (here) => ahead === here)
      );
    return open
      ? { ...wild, ...next }
      : { ...wild, rest: 1, tx: wild.x, tz: wild.z };
  }
  const roll = (channel: number) =>
    unitOf(seed + wild.index * 13, wild.steps, channel);
  const goal = {
    x: wild.tx + (roll(1) - 0.5) * 8,
    z: wild.tz + (roll(2) - 0.5) * 8,
  };
  const ok = standsOn(cells, home, goal.x, goal.z);
  return {
    ...wild,
    rest: 1 + roll(3) * 4,
    steps: wild.steps + 1,
    tx: ok ? goal.x : wild.tx,
    tz: ok ? goal.z : wild.tz,
  };
}

/** Where a creature of the sky, the sea or the flowers is at `time`, and which way it faces. */
function loopOf(
  wild: Wild,
  home: "sky" | "sea" | "bloom",
  size: number,
  time: number
) {
  const middle = SPAN / 2;
  const loops = {
    bloom: {
      radius: 1.5 + (wild.phase % 1.5),
      speed: 0.9,
      x: middle - 7,
      y: SEA_LEVEL + 2.2,
      z: middle + 6.5,
    },
    // Sea visitors keep to water at least three blocks deep, inside the whale's round (ADR 0047, D24).
    sea: {
      radius: shoreOf(size) + 4,
      speed: 1.2,
      x: middle,
      y: SEA_LEVEL - 0.9,
      z: middle,
    },
    sky: {
      radius: 8 + (wild.phase % 10),
      speed: 2.4,
      x: middle,
      y: SEA_LEVEL + 12 + (wild.phase % 4),
      z: middle,
    },
  }[home];
  const angle = wild.phase + (time * loops.speed) / loops.radius;
  return {
    heading: angle + Math.PI / 2,
    x: loops.x + Math.cos(angle) * loops.radius,
    y: loops.y + Math.sin(time * 3 + wild.phase) * (home === "sea" ? 0 : 0.3),
    z: loops.z + Math.sin(angle) * loops.radius,
  };
}

/** How many fish of a species swim together, by its length in blocks: shoals of small fish, a few big ones, a big one alone. */
function shoalOf(length: number) {
  return Math.min(9, Math.max(1, Math.round(2.4 / length)));
}

/** The top of the sea floor under a column: its highest solid block below the surface, none where nothing lies under the water. */
function seabedOf(cells: Cells, x: number, z: number) {
  return Option.map(
    Arr.findFirst(
      Arr.makeBy(SEA_LEVEL, (index) => SEA_LEVEL - 1 - index),
      (y) => {
        const kind =
          LOOK.kinds[blockAt(cells, Math.floor(x), y, Math.floor(z))];
        return kind === KIND.solid || kind === KIND.cutout;
      }
    ),
    (y) => y + 1
  );
}

/** The way a creature on a loop faces, as a body's yaw, from the heading of its loop. */
function yawOf(heading: number) {
  return Math.atan2(Math.cos(heading), Math.sin(heading));
}

/**
 * A sea visitor on its loop (ADR 0047, D24): a waterbird floating on the
 * surface; a lobster walking the sea floor; a fish in a school of its kind;
 * an eel, a ray, a turtle or a sea snake swimming alone. Each one under the
 * surface keeps between the sea floor and the surface, and one with no water
 * there is left out rather than drawn through the ground.
 */
function seaPlaces(cells: Cells, wild: Wild, size: number, time: number) {
  const species = SPECIES[wild.index];
  const length = Math.max(0.2, species.height);
  const at = loopOf(wild, "sea", size, time);
  const yaw = yawOf(at.heading);
  if (species.family === "waterbird") {
    return [[at.x, SEA_LEVEL - 0.2, at.z, yaw, 0, NO_SHADOW]];
  }
  const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
  const half = length / 4;
  // One that swims alone keeps to its loop; a shoal spreads round it.
  const school =
    species.family === "fish"
      ? schoolOf(shoalOf(length), length, wild.index * 131)
      : [{ at: [0, 0, 0], lag: 0.5 }];
  return Arr.filterMap(school, (fish) => {
    const [ox, oy, oz] = fish.at;
    const x = at.x + ox * c + oz * s;
    const z = at.z - ox * s + oz * c;
    const floor = seabedOf(cells, x, z);
    const low = Option.match(floor, {
      onNone: () => Number.NEGATIVE_INFINITY,
      onSome: (top) => top + half + 0.1,
    });
    const high = SEA_LEVEL - 0.2 - half;
    if (low > high) {
      return Result.failVoid;
    }
    // A lobster stands on the floor; every other swimmer holds its depth in the school.
    const y =
      species.family === "crab"
        ? Option.getOrElse(floor, () => at.y)
        : Math.min(high, Math.max(low, at.y + oy));
    return Result.succeed([
      x,
      y,
      z,
      yaw + (fish.lag - 0.5) * 0.3,
      0,
      NO_SHADOW,
    ]);
  });
}

/**
 * A walker, a flyer or a flower visitor as one body: a walker on its ground
 * facing its goal, bobbing while it walks, its shadow at its feet; a flyer on
 * its loop facing its way, its shadow on the ground below, none over water.
 */
function creaturePlaces(
  cells: Cells,
  wild: Wild,
  home: "land" | "shore" | "sky" | "bloom",
  size: number,
  time: number
) {
  if (home === "land" || home === "shore") {
    const [dx, dz] = [wild.tx - wild.x, wild.tz - wild.z];
    const moving = Math.hypot(dx, dz) > 0.05;
    const ground = Option.match(
      groundOf(cells, Math.floor(wild.x), Math.floor(wild.z)),
      { onNone: () => SEA_LEVEL, onSome: ({ y }) => y + 1 }
    );
    return [
      [
        wild.x,
        ground,
        wild.z,
        moving ? Math.atan2(dx, dz) : wild.phase,
        moving && wild.rest <= 0 ? 0.04 : 0,
        ground,
      ],
    ];
  }
  const at = loopOf(wild, home, size, time);
  const shadow = Option.match(
    groundOf(cells, Math.floor(at.x), Math.floor(at.z)),
    {
      onNone: () => NO_SHADOW,
      onSome: ({ block, y }) =>
        LOOK.kinds[block] === KIND.liquid ? NO_SHADOW : y + 1,
    }
  );
  return [[at.x, at.y, at.z, yawOf(at.heading), 0, shadow]];
}

/**
 * The wild creatures of the day as true 3D bodies at their real size (ADR
 * 0047, D24 and D25), one model a species with its bodies as one run of
 * numbers, `BODY_STRIDE` a body: walkers on their ground, flyers on their
 * loops, and each sea species on or under the sea. A day brings each
 * species once.
 */
export function wildBodies(
  cells: Cells,
  wilds: readonly Wild[],
  size: number,
  time: number
) {
  return Arr.map(wilds, (wild) => {
    const home = SPECIES[wild.index].home;
    const places =
      home === "sea"
        ? seaPlaces(cells, wild, size, time)
        : creaturePlaces(cells, wild, home, size, time);
    const model = { _tag: "species", index: wild.index } as const;
    return [model, Float32Array.from(Arr.flatten(places))] as const;
  });
}

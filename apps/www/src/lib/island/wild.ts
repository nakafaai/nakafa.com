import { idOf } from "@repo/backend/confect/island/blocks";
import { footprintOf, SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option, Order, Schema } from "effect";
import { SPECIES_SLOT, slotUv, speciesPixels } from "@/lib/island/atlas";
import { SPECIES } from "@/lib/island/fauna/species";
import { groundOf } from "@/lib/island/life";
import { unitOf } from "@/lib/island/noise";
import { TILE } from "@/lib/island/tiles/paint";
import { type Cells, SEA_LEVEL } from "@/lib/island/world";

/** How many of each home's species a day brings to the island. */
const VISITORS = { bloom: 4, land: 6, sea: 6, shore: 3, sky: 5 } as const;

/** The ground each walking home stands on. */
const GROUNDS = {
  land: [idOf("grass"), idOf("dirt")],
  shore: [idOf("sand")],
} as const;

/** The smallest and largest a wild creature is drawn, in blocks, so a beetle still shows and a giraffe still fits. */
const DRAWN = { largest: 5.5, smallest: 0.32 } as const;

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

/** How many rows of its tile a species' drawing fills, so it can be drawn at its real height. */
const ROWS = Arr.map(SPECIES, (_species, index) => {
  const pixels = speciesPixels(index);
  return Arr.reduce(
    Arr.makeBy(TILE, (row) => row),
    0,
    (rows, row) =>
      Arr.some(
        Arr.makeBy(TILE, (x) => x),
        (x) => pixels[(row * TILE + x) * 4 + 3] > 0
      )
        ? rows + 1
        : rows
  );
});

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
      return Arr.zipWith(
        kinds,
        Arr.take(spots, kinds.length),
        ({ index }, { x, z }) => ({
          index,
          phase: unitOf(seed, index, day, 9) * Math.PI * 2,
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
    return {
      ...wild,
      x: wild.x + (dx / distance) * reach,
      z: wild.z + (dz / distance) * reach,
    };
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

/** The size a species is drawn at: its real height spread over the rows its drawing fills. */
function drawnOf(index: number) {
  const real = Math.min(
    DRAWN.largest,
    Math.max(DRAWN.smallest, SPECIES[index].height)
  );
  return (real * TILE) / Math.max(1, ROWS[index]);
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
    sea: {
      radius: size / 2 + 1 + (wild.phase % 4),
      speed: 1.2,
      x: middle,
      y: SEA_LEVEL - 0.08,
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

/** A quad's four corners, as the chunk program reads them, from its slot and its corners in the world. */
function quadOf(
  slot: number,
  corners: readonly (readonly [number, number, number])[],
  flip: boolean
) {
  return Arr.flatMap(
    [
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ] as const,
    ([u, v], corner) => {
      const [tu, tv] = slotUv(slot, u, v, flip);
      return [...corners[corner], tu, tv, 1, 1, 0];
    }
  );
}

/**
 * The wild creatures as quads in the chunk program's vertex layout: walkers
 * and flyers stand up facing the camera turned by `yaw`, at their real
 * height; swimmers lie flat on the sea, heading along their loop.
 */
export function wildVertices(
  cells: Cells,
  wilds: readonly Wild[],
  size: number,
  yaw: number,
  time: number
) {
  const right = [Math.cos(yaw), -Math.sin(yaw)] as const;
  return Arr.flatMap(wilds, (wild) => {
    const species = SPECIES[wild.index];
    const drawn = drawnOf(wild.index);
    const slot = SPECIES_SLOT + wild.index;
    if (species.home === "sea") {
      const at = loopOf(wild, "sea", size, time);
      const ahead = [Math.cos(at.heading), Math.sin(at.heading)] as const;
      const corner = (along: number, across: number) =>
        [
          at.x + ahead[0] * along * drawn - ahead[1] * across * drawn,
          at.y,
          at.z + ahead[1] * along * drawn + ahead[0] * across * drawn,
        ] as const;
      return quadOf(
        slot,
        [
          corner(-0.5, 0.5),
          corner(0.5, 0.5),
          corner(0.5, -0.5),
          corner(-0.5, -0.5),
        ],
        false
      );
    }
    const home = species.home;
    const at =
      home === "land" || home === "shore"
        ? {
            heading: Math.atan2(wild.tz - wild.z, wild.tx - wild.x),
            x: wild.x,
            y: Option.match(
              groundOf(cells, Math.floor(wild.x), Math.floor(wild.z)),
              {
                onNone: () => SEA_LEVEL,
                onSome: ({ y }) => y + 1,
              }
            ),
            z: wild.z,
          }
        : loopOf(wild, home, size, time);
    const flip =
      Math.cos(at.heading) * right[0] + Math.sin(at.heading) * right[1] < 0;
    const side = (u: number) =>
      [
        at.x + right[0] * (u - 0.5) * drawn,
        at.z + right[1] * (u - 0.5) * drawn,
      ] as const;
    const corner = (u: number, up: number) => {
      const [x, z] = side(u);
      return [x, at.y + up * drawn, z] as const;
    };
    return quadOf(
      slot,
      [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)],
      flip
    );
  });
}

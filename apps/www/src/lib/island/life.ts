import { idOf } from "@repo/backend/confect/island/blocks";
import { footprintOf, HEIGHT, SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option, Order, Schema } from "effect";
import { SLOTS, slotUv, TileName } from "@/lib/island/atlas";
import { KIND, LOOK } from "@/lib/island/look";
import { STRIDE } from "@/lib/island/mesh";
import { unitOf } from "@/lib/island/noise";
import { SCALE } from "@/lib/island/scale";
import { TILE } from "@/lib/island/tiles/paint";
import { blockAt, type Cells, SEA_LEVEL } from "@/lib/island/world";

const WATER = idOf("water");
const PATH = idOf("path");
const WALKABLE = [idOf("grass"), idOf("dirt"), idOf("sand"), PATH];

/** The villagers who walk the village's paths (ADR 0047, D10). */
const FOLK = ["cat", "rabbit", "bear"] as const;

/**
 * One creature of the island (ADR 0047, D8 and D10): a hen that walks the
 * ground, a duck that swims the water, or a villager who walks the paths;
 * where it stands and where it is going, how many steps it has taken, and how
 * long it still rests before it goes on.
 */
const Animal = Schema.Struct({
  kind: Schema.Literals(["hen", "duck", ...FOLK]),
  rest: Schema.Finite,
  steps: Schema.Int,
  tx: Schema.Finite,
  tz: Schema.Finite,
  x: Schema.Finite,
  z: Schema.Finite,
});
type Animal = typeof Animal.Type;

/** The top block of a column and the cell over it, none for an empty column. */
export function groundOf(cells: Cells, x: number, z: number) {
  const top = Arr.findFirst(
    Arr.makeBy(HEIGHT, (index) => HEIGHT - 1 - index),
    (y) => LOOK.kinds[blockAt(cells, x, y, z)] !== KIND.air
  );
  return Option.map(top, (y) => ({ block: blockAt(cells, x, y, z), y }));
}

/** Whether a creature of this kind can stand in a column: a hen on open ground, a duck on the sea, a villager on a path. */
export function suitsOf(
  kind: Animal["kind"],
  cells: Cells,
  x: number,
  z: number
) {
  return Option.exists(
    groundOf(cells, Math.floor(x), Math.floor(z)),
    ({ block }) => {
      if (kind === "duck") {
        return block === WATER;
      }
      return kind === "hen" ? Arr.contains(WALKABLE, block) : block === PATH;
    }
  );
}

/** The creatures a new game opens with: three hens on the island, two ducks off its shore, and a cat, a rabbit and a bear on the village paths. */
export function herdOf(cells: Cells, seed: number, size: number) {
  const footprint = footprintOf(size);
  const columns = Arr.sort(
    Arr.flatMap(
      Arr.makeBy(size, (dz) => footprint.from + dz),
      (z) =>
        Arr.map(
          Arr.makeBy(size, (dx) => footprint.from + dx),
          (x) => ({ x, z })
        )
    ),
    Order.mapInput(Order.Number, ({ x, z }: { x: number; z: number }) =>
      unitOf(seed + 9, x, 0, z)
    )
  );
  const placed = (kind: Animal["kind"], x: number, z: number): Animal => ({
    kind,
    rest: 0,
    steps: 0,
    tx: x + 0.5,
    tz: z + 0.5,
    x: x + 0.5,
    z: z + 0.5,
  });
  const suiting = (kind: Animal["kind"], count: number) =>
    Arr.take(
      Arr.filter(columns, ({ x, z }) => suitsOf(kind, cells, x + 0.5, z + 0.5)),
      count
    );
  const pick = (kind: Animal["kind"], count: number) =>
    Arr.map(suiting(kind, count), ({ x, z }) => placed(kind, x, z));
  const folk = Arr.zipWith(
    FOLK,
    suiting("cat", FOLK.length),
    (kind, { x, z }) => placed(kind, x, z)
  );
  return Arr.appendAll(Arr.appendAll(pick("hen", 3), pick("duck", 2)), folk);
}

/** How fast each kind moves, in cells a second. */
const SPEED = {
  bear: 0.9,
  cat: 1.2,
  duck: 0.6,
  hen: 1.1,
  rabbit: 1.3,
} as const;

/**
 * One animal after `dt` seconds: resting, walking toward its goal, or, once
 * there, picking a new goal a few cells away that suits it, from its seed and
 * its step count, and resting a moment first.
 */
export function wander(
  cells: Cells,
  animal: Animal,
  seed: number,
  index: number,
  dt: number
): Animal {
  if (animal.rest > 0) {
    return { ...animal, rest: Math.max(0, animal.rest - dt) };
  }
  const dx = animal.tx - animal.x;
  const dz = animal.tz - animal.z;
  const distance = Math.hypot(dx, dz);
  const reach = SPEED[animal.kind] * dt;
  if (distance > reach) {
    return {
      ...animal,
      x: animal.x + (dx / distance) * reach,
      z: animal.z + (dz / distance) * reach,
    };
  }
  const roll = (channel: number) =>
    unitOf(seed + index * 31, animal.steps, channel);
  const goal = {
    x: animal.tx + (roll(1) - 0.5) * 6,
    z: animal.tz + (roll(2) - 0.5) * 6,
  };
  const ok = suitsOf(animal.kind, cells, goal.x, goal.z);
  return {
    ...animal,
    rest: 0.5 + roll(3) * 2.5,
    steps: animal.steps + 1,
    tx: ok ? goal.x : animal.tx,
    tz: ok ? goal.z : animal.tz,
    x: animal.tx,
    z: animal.tz,
  };
}

/** How fast Nina swims her loop, in cells a second. */
const NINA_SPEED = 1.5;

/**
 * Where Nina, the hammerhead (ADR 0047, D8), swims at `time`: a loop around
 * the island just past its footprint, where the sea is, weaving in and out a
 * little, and the way she faces along it.
 */
export function ninaAt(size: number, time: number) {
  const radius = size / 2 + 2;
  const angle = (time * NINA_SPEED) / radius;
  const reach = radius + Math.sin(angle * 5) * 1.2;
  const outward = Math.cos(angle * 5) * 6;
  const middle = SPAN / 2;
  return {
    heading: Math.atan2(
      outward * Math.sin(angle) + reach * Math.cos(angle),
      outward * Math.cos(angle) - reach * Math.sin(angle)
    ),
    x: middle + Math.cos(angle) * reach,
    z: middle + Math.sin(angle) * reach,
  };
}

/** Nina's four corners, flat on the sea's surface, her head along her heading and her tail beating. */
function ninaVertices(size: number, time: number) {
  const nina = ninaAt(size, time);
  const ahead = [Math.cos(nina.heading), Math.sin(nina.heading)] as const;
  const name: TileName = Math.floor(time * 3) % 2 === 1 ? "ninaStep" : "nina";
  return Arr.flatMap(
    [
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ] as const,
    ([u, v]) => {
      const along = (u - 0.5) * SCALE.nina;
      const across = (v - 0.5) * SCALE.nina;
      const [tu, tv] = slotUv(SLOTS[name], u, v, false);
      return [
        nina.x + ahead[0] * along - ahead[1] * across,
        SEA_LEVEL - 0.06,
        nina.z + ahead[1] * along + ahead[0] * across,
        tu,
        tv,
        1,
        1,
        0,
      ];
    }
  );
}

/** One upright sprite: a tile, where its feet stand, how tall it is drawn in blocks, and whether it is mirrored. */
const Sprite = Schema.Struct({
  flip: Schema.Boolean,
  name: TileName,
  size: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});
type Sprite = typeof Sprite.Type;

/** How many of a fowl's tile rows its body fills, so it is drawn at its real height. */
const FOWL_ROWS = { duck: 9, hen: 13 } as const;

/**
 * The sprites one creature is drawn as: a hen or a duck as one tile at its
 * real height, a villager as a head tile over a body tile, two blocks tall,
 * stepping as they walk. Each faces the way it moves.
 */
function spritesOf(
  cells: Cells,
  animal: Animal,
  index: number,
  right: readonly [number, number, number],
  time: number
): readonly Sprite[] {
  const flip =
    (animal.tx - animal.x) * right[0] + (animal.tz - animal.z) * right[2] < 0;
  const stride = animal.rest === 0 && Math.floor(time * 6) % 2 === 1;
  const ground = Option.match(
    groundOf(cells, Math.floor(animal.x), Math.floor(animal.z)),
    {
      onNone: () => SEA_LEVEL,
      onSome: ({ y }) => y + 1,
    }
  );
  const at = { flip, x: animal.x, z: animal.z };
  if (animal.kind === "duck") {
    const size = (SCALE.fowl * TILE) / FOWL_ROWS.duck;
    const bob = Math.sin(time * 2 + index) * 0.04;
    return [
      { ...at, name: "duck", size, y: SEA_LEVEL - 0.15 - size * 0.55 + bob },
    ];
  }
  if (animal.kind === "hen") {
    const size = (SCALE.fowl * TILE) / FOWL_ROWS.hen;
    return [
      { ...at, name: stride ? "henStep" : "hen", size, y: ground - 0.02 },
    ];
  }
  const half = SCALE.person / 2;
  return [
    {
      ...at,
      name: `${animal.kind}${stride ? "Step" : "Bottom"}`,
      size: half,
      y: ground,
    },
    { ...at, name: `${animal.kind}Top`, size: half, y: ground + half },
  ];
}

/** A sprite's four corners as a quad that faces the camera, standing on its feet. */
function billboardOf(sprite: Sprite, right: readonly [number, number, number]) {
  return Arr.flatMap(
    [
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ] as const,
    ([u, v]) => {
      const side = (u - 0.5) * sprite.size;
      const [tu, tv] = slotUv(SLOTS[sprite.name], u, v, sprite.flip);
      return [
        sprite.x + right[0] * side,
        sprite.y + (1 - v) * sprite.size,
        sprite.z + right[2] * side,
        tu,
        tv,
        1,
        1,
        0,
      ];
    }
  );
}

/**
 * The island's life as quads in the chunk program's vertex layout: every
 * creature's sprites facing the camera turned by `yaw`, the wild visitors'
 * quads (`wild`), then Nina lying flat on the sea, swimming her loop.
 */
export function herdQuads(
  cells: Cells,
  herd: readonly Animal[],
  size: number,
  yaw: number,
  time: number,
  wild: readonly number[] = []
) {
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)] as const;
  const sprites = Arr.flatMap(herd, (animal, index) =>
    spritesOf(cells, animal, index, right, time)
  );
  const vertices = new Float32Array(
    Arr.appendAll(
      Arr.appendAll(
        Arr.flatMap(sprites, (sprite) => billboardOf(sprite, right)),
        wild
      ),
      ninaVertices(size, time)
    )
  );
  const quads = sprites.length + wild.length / (4 * STRIDE) + 1;
  const indices = new Uint32Array(
    Arr.flatMap(
      Arr.makeBy(quads, (quad) => quad),
      (quad) => Arr.map([0, 1, 2, 0, 2, 3], (value) => value + quad * 4)
    )
  );
  return { indices, vertices };
}

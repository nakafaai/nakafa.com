import { idOf } from "@repo/backend/confect/island/blocks";
import { footprintOf, HEIGHT, SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option, Order, Schema } from "effect";
import { ATLAS_TILES, SLOTS, type TileName } from "@/lib/island/atlas";
import { KIND, LOOK } from "@/lib/island/look";
import { STRIDE } from "@/lib/island/mesh";
import { unitOf } from "@/lib/island/noise";
import { blockAt, type Cells, SEA_LEVEL } from "@/lib/island/world";

const WATER = idOf("water");
const WALKABLE = [idOf("grass"), idOf("dirt"), idOf("sand"), idOf("path")];

/**
 * One animal of the island (ADR 0047, D8): a hen that walks the ground or a
 * duck that swims the water, where it stands and where it is going, how many
 * steps it has taken, and how long it still rests before it goes on.
 */
const Animal = Schema.Struct({
  kind: Schema.Literals(["hen", "duck"]),
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

/** Whether an animal of this kind can stand in a column: a hen on open ground, a duck on the sea. */
export function suitsOf(
  kind: Animal["kind"],
  cells: Cells,
  x: number,
  z: number
) {
  return Option.exists(
    groundOf(cells, Math.floor(x), Math.floor(z)),
    ({ block }) =>
      kind === "duck" ? block === WATER : Arr.contains(WALKABLE, block)
  );
}

/** The hens and ducks a new game opens with: three hens on the island and two ducks off its shore. */
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
  const pick = (kind: Animal["kind"], count: number) =>
    Arr.map(
      Arr.take(
        Arr.filter(columns, ({ x, z }) =>
          suitsOf(kind, cells, x + 0.5, z + 0.5)
        ),
        count
      ),
      ({ x, z }): Animal => ({
        kind,
        rest: 0,
        steps: 0,
        tx: x + 0.5,
        tz: z + 0.5,
        x: x + 0.5,
        z: z + 0.5,
      })
    );
  return Arr.appendAll(pick("hen", 3), pick("duck", 2));
}

/** How fast each kind moves, in cells a second. */
const SPEED = { duck: 0.6, hen: 1.1 } as const;

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

/** The atlas coordinate of a sprite tile's corner, inset a hair, mirrored when `flip`. */
function spriteUv(name: TileName, u: number, v: number, flip: boolean) {
  const slot = SLOTS[name];
  const across = flip ? 1 - u : u;
  return [
    ((slot % ATLAS_TILES) + 0.002 + across * 0.996) / ATLAS_TILES,
    (Math.floor(slot / ATLAS_TILES) + 0.002 + v * 0.996) / ATLAS_TILES,
  ] as const;
}

/** The hen's frame: mid-stride or standing. */
function spriteOfHen(stride: boolean): TileName {
  return stride ? "henStep" : "hen";
}

/** How fast Nina swims her loop, in cells a second. */
const NINA_SPEED = 1.5;

/** Nina's length on the water, in cells. */
const NINA_LENGTH = 2.6;

/**
 * Where Nina, the hammerhead (ADR 0047, D8), swims at `time`: a loop around
 * the island just past its footprint, where the sea is, weaving in and out a
 * little, and the way she faces along it.
 */
export function ninaAt(size: number, time: number) {
  const radius = size / 2 + 4;
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
      const along = (u - 0.5) * NINA_LENGTH;
      const across = (v - 0.5) * NINA_LENGTH;
      const [tu, tv] = spriteUv(name, u, v, false);
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

/**
 * The island's life as quads in the chunk program's vertex layout: each
 * animal of the herd faces the camera turned by `yaw` (a hen stands on her
 * ground and steps as she walks, a duck floats on the sea and bobs, and each
 * faces the way it moves), and Nina lies flat on the sea, swimming her loop.
 */
export function herdQuads(
  cells: Cells,
  herd: readonly Animal[],
  size: number,
  yaw: number,
  time: number
) {
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)] as const;
  const vertices = new Float32Array((herd.length + 1) * 4 * STRIDE);
  const indices = new Uint32Array(
    Arr.flatMap(
      Arr.makeBy(herd.length + 1, (quad) => quad),
      (quad) => Arr.map([0, 1, 2, 0, 2, 3], (value) => value + quad * 4)
    )
  );
  vertices.set(ninaVertices(size, time), herd.length * 4 * STRIDE);
  Arr.forEach(herd, (animal, index) => {
    const duck = animal.kind === "duck";
    const ground = Option.match(
      groundOf(cells, Math.floor(animal.x), Math.floor(animal.z)),
      {
        onNone: () => SEA_LEVEL,
        onSome: ({ y }) => y + 1,
      }
    );
    const base = duck
      ? SEA_LEVEL - 0.45 + Math.sin(time * 2 + index) * 0.04
      : ground - 0.15;
    // A sprite is drawn a little over a cell tall, so an animal reads among the blocks.
    const scale = duck ? 1.2 : 1.4;
    const stride = animal.rest === 0 && Math.floor(time * 6) % 2 === 1;
    const name: TileName = duck ? "duck" : spriteOfHen(stride);
    const flip =
      (animal.tx - animal.x) * right[0] + (animal.tz - animal.z) * right[2] < 0;
    Arr.forEach(
      [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ] as const,
      ([u, v], corner) => {
        const side = (u - 0.5) * scale;
        const [tu, tv] = spriteUv(name, u, v, flip);
        vertices.set(
          [
            animal.x + right[0] * side,
            base + (1 - v) * scale,
            animal.z + right[2] * side,
            tu,
            tv,
            1,
            1,
            0,
          ],
          (index * 4 + corner) * STRIDE
        );
      }
    );
  });
  return { indices, vertices };
}

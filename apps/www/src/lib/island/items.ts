import { BlockKey, idOf, opensAt } from "@repo/backend/confect/island/blocks";
import { footprintOf } from "@repo/backend/confect/island/world";
import { Array as Arr, Order, Result, Schema } from "effect";
import type { Edit } from "@/lib/island/edits";
import { KIND, LOOK } from "@/lib/island/look";
import { SCALE } from "@/lib/island/scale";
import { type Cells, cellOf, isInside } from "@/lib/island/world";

/**
 * The ready-made things a learner places with one press (ADR 0047, D10): a
 * cottage, a tree, a well and a lamp post, each built of the same blocks the
 * learner builds with, at the world's one scale.
 */
export const ItemKey = Schema.Literals(["house", "tree", "well", "lamp"]);
export type ItemKey = typeof ItemKey.Type;

/** Every item, in the order the block book shows them. */
export const ITEM_KEYS = ItemKey.literals;

/** One cell of an item, from its anchor: across, up from the ground, deep, and its block. */
const Part = Schema.Struct({
  block: BlockKey,
  x: Schema.Int,
  y: Schema.Int,
  z: Schema.Int,
});
type Part = typeof Part.Type;

/** A part of an item's block, at (x, y, z) from its anchor. */
function part(block: BlockKey, x: number, y: number, z: number): Part {
  return { block, x, y, z };
}

/** Every cell of a box's edge at one height, from (0, 0) to (width - 1, depth - 1). */
function ringOf(width: number, depth: number) {
  return Arr.filter(
    Arr.flatMap(
      Arr.makeBy(depth, (z) => z),
      (z) => Arr.makeBy(width, (x) => ({ x, z }))
    ),
    ({ x, z }) => x === 0 || z === 0 || x === width - 1 || z === depth - 1
  );
}

/** One cell of a cottage's walls: a log corner, a glass window, white wall, or nothing in the doorway. */
function wallOf(x: number, y: number, z: number) {
  const { depth, width } = SCALE.house;
  const front = z === depth - 1;
  if (front && x === (width - 1) / 2 && y < SCALE.door) {
    return Result.failVoid;
  }
  const across = z === 0 || front;
  if ((x === 0 || x === width - 1) && across) {
    return Result.succeed(part("log", x, y, z));
  }
  const window = across
    ? x === 1 || x === width - 2
    : z === 2 || z === depth - 3;
  return Result.succeed(part(y === 1 && window ? "glass" : "plaster", x, y, z));
}

/**
 * A cottage facing +z: log corners, white walls with glass windows, a door
 * two blocks high in the middle of its front, a stepped red roof one block
 * over each gable, and a brick chimney.
 */
function houseParts() {
  const { depth, width } = SCALE.house;
  const walls = Arr.flatMap(
    Arr.makeBy(SCALE.storey, (y) => y),
    (y) => Arr.filterMap(ringOf(width, depth), ({ x, z }) => wallOf(x, y, z))
  );
  const steps = depth / 2;
  const roof = Arr.flatMap(
    Arr.makeBy(steps, (step) => step),
    (step) => {
      const y = SCALE.storey + step;
      const eaves = Arr.flatMap([step, depth - 1 - step], (z) =>
        Arr.makeBy(width + 2, (index) => part("roof", index - 1, y, z))
      );
      const gables = Arr.flatMap(
        Arr.makeBy(
          Math.max(0, depth - 2 - step * 2),
          (index) => step + 1 + index
        ),
        (z) => [part("plaster", 0, y, z), part("plaster", width - 1, y, z)]
      );
      return Arr.appendAll(eaves, gables);
    }
  );
  const chimney = { x: width - 2, z: 1 };
  const withChimney = Arr.filter(
    roof,
    (cell) =>
      !(
        cell.x === chimney.x &&
        cell.z === chimney.z &&
        cell.y === SCALE.storey + 1
      )
  );
  return Arr.appendAll(
    Arr.appendAll(walls, withChimney),
    Arr.makeBy(SCALE.house.height - SCALE.storey - 1, (index) =>
      part("brick", chimney.x, SCALE.storey + 1 + index, chimney.z)
    )
  );
}

/** A tree: a log trunk five blocks high and a round crown of leaves around its top. */
function treeParts() {
  const trunk = SCALE.tree.to - 3;
  const crown = Arr.flatMap(
    Arr.makeBy(5, (dy) => dy - 2),
    (dy) =>
      Arr.flatMap(
        Arr.makeBy(5, (dz) => dz - 2),
        (dz) =>
          Arr.filterMap(
            Arr.makeBy(5, (dx) => dx - 2),
            (dx) =>
              dx * dx + dz * dz + dy * dy * 1.6 > 5.2 ||
              (dx === 0 && dz === 0 && dy <= 0)
                ? Result.failVoid
                : Result.succeed(part("leaves", dx, trunk - 1 + dy, dz))
          )
      )
  );
  return Arr.appendAll(
    Arr.makeBy(trunk, (y) => part("log", 0, y, 0)),
    crown
  );
}

/** A well: a ring of cobblestone round its water, two posts and a little roof. */
function wellParts() {
  return Arr.appendAll(
    Arr.append(
      Arr.map(ringOf(3, 3), ({ x, z }) => part("cobble", x, 0, z)),
      part("water", 1, 0, 1)
    ),
    Arr.appendAll(
      Arr.flatMap([1, 2], (y) => [part("log", 0, y, 1), part("log", 2, y, 1)]),
      Arr.flatMap([0, 1, 2], (x) =>
        Arr.map([0, 1, 2], (z) => part("roof", x, 3, z))
      )
    )
  );
}

/** A lamp post: two logs and the lantern on top. */
function lampParts() {
  return Arr.append(
    Arr.makeBy(SCALE.lamp - 1, (y) => part("log", 0, y, 0)),
    part("lantern", 0, SCALE.lamp - 1, 0)
  );
}

/** Each item's parts, and the cell of them that stands on the anchor. */
const ITEMS = {
  house: { origin: { x: 3, z: 3 }, parts: houseParts() },
  lamp: { origin: { x: 0, z: 0 }, parts: lampParts() },
  tree: { origin: { x: 0, z: 0 }, parts: treeParts() },
  well: { origin: { x: 1, z: 1 }, parts: wellParts() },
};

/**
 * An item's parts turned by `turn` quarter turns around its anchor; a turn of
 * 0 faces its front to +z, and each turn faces it a quarter further toward +x.
 */
export function partsOf(item: ItemKey, turn: number) {
  const { origin, parts } = ITEMS[item];
  const quarter = ((turn % 4) + 4) % 4;
  return Arr.map(parts, (cell) => {
    const x = cell.x - origin.x;
    const z = cell.z - origin.z;
    const [tx, tz] = [
      [x, z],
      [z, -x],
      [-x, -z],
      [-z, x],
    ][quarter];
    return { ...cell, x: tx, z: tz };
  });
}

/** The level that opens an item: the latest level that opens any of its blocks. */
export function itemOpensAt(item: ItemKey) {
  return Arr.reduce(ITEMS[item].parts, 1, (level, cell) =>
    Math.max(level, opensAt(cell.block))
  );
}

/** The quarter turn that faces an item's front toward a camera turned by `yaw`. */
export function turnOf(yaw: number) {
  return ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
}

/** Why an item cannot stand at a place: off the footprint, into something solid, or over nothing. */
const ItemRefused = Schema.Literals(["outside", "room", "ground"]);
type ItemRefused = typeof ItemRefused.Type;

const AIR = 0;
const WATER = idOf("water");

/**
 * The edits that build an item with its ground row on `anchor` (ADR 0047, D10):
 * every part stays inside the footprint, fills only air or plants, and the
 * ground row stands on solid blocks, so nothing floats or cuts into the world.
 */
export function itemPlanOf(
  cells: Cells,
  item: ItemKey,
  anchor: readonly [number, number, number],
  turn: number,
  size: number
) {
  const footprint = footprintOf(size);
  const placed = Arr.map(partsOf(item, turn), (cell) => ({
    block: idOf(cell.block),
    x: anchor[0] + cell.x,
    y: anchor[1] + cell.y,
    z: anchor[2] + cell.z,
  }));
  const outside = Arr.some(
    placed,
    ({ x, y, z }) =>
      !isInside(x, y, z) ||
      y < 1 ||
      x < footprint.from ||
      x > footprint.to ||
      z < footprint.from ||
      z > footprint.to
  );
  if (outside) {
    return Result.fail<ItemRefused>("outside");
  }
  const blocked = Arr.some(placed, ({ x, y, z }) => {
    const there = cells[cellOf(x, y, z)];
    return there !== AIR && LOOK.kinds[there] !== KIND.cross;
  });
  if (blocked) {
    return Result.fail<ItemRefused>("room");
  }
  const floating = Arr.some(placed, ({ x, y, z }) => {
    if (y !== anchor[1]) {
      return false;
    }
    const below = cells[cellOf(x, y - 1, z)];
    return below === AIR || below === WATER || LOOK.kinds[below] === KIND.cross;
  });
  if (floating) {
    return Result.fail<ItemRefused>("ground");
  }
  return Result.succeed(
    Arr.sort(
      Arr.map(
        placed,
        ({ block, x, y, z }): Edit => ({
          after: block,
          before: cells[cellOf(x, y, z)],
          x,
          y,
          z,
        })
      ),
      Order.mapInput(Order.Number, (edit: Edit) => edit.y)
    )
  );
}

/** Builds an item straight into generated cells, as the village does; nothing is checked. */
export function stampItem(
  cells: Cells,
  item: ItemKey,
  anchor: readonly [number, number, number],
  turn: number
) {
  for (const cell of partsOf(item, turn)) {
    const x = anchor[0] + cell.x;
    const y = anchor[1] + cell.y;
    const z = anchor[2] + cell.z;
    if (isInside(x, y, z)) {
      cells[cellOf(x, y, z)] = idOf(cell.block);
    }
  }
}

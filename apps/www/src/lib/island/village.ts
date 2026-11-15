import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr } from "effect";
import { stampItem } from "@/lib/island/items";
import { type Cells, cellOf, SEA_LEVEL } from "@/lib/island/world";

/** The middle of the world, where the village's well stands. */
const MIDDLE = SPAN / 2;

/** How far from the middle the village reaches, in cells; its ground is flat and no wild tree grows on it. */
export const VILLAGE = 14;

/** The ground row the village is built on, and the row its buildings stand in. */
const GROUND = SEA_LEVEL;
const FLOOR = GROUND + 1;

const PATH = idOf("path");
const DIRT = idOf("dirt");
/** The crops of the village garden, a row each. */
const CROPS = [idOf("rice"), idOf("corn"), idOf("cabbage"), idOf("chili")];
const LOG = idOf("log");

/** Paves the ground of every cell from (x0, z0) to (x1, z1), inclusive. */
function pave(
  cells: Cells,
  from: readonly [number, number],
  to: readonly [number, number],
  block: number
) {
  for (let z = from[1]; z <= to[1]; z += 1) {
    for (let x = from[0]; x <= to[0]; x += 1) {
      cells[cellOf(x, GROUND, z)] = block;
    }
  }
}

/**
 * The village every world opens with (ADR 0047, D10): a square with a well, two
 * paths crossing it, three cottages with their doors on a path, a fenced garden
 * of flowers, lamp posts that light up at night, and two trees. It is laid
 * over the flat middle of the island, so it never floats or sinks.
 */
export function layVillage(cells: Cells) {
  const reach = VILLAGE - 1;
  pave(cells, [MIDDLE - 3, MIDDLE - 3], [MIDDLE + 3, MIDDLE + 3], PATH);
  pave(cells, [MIDDLE - 1, MIDDLE - reach], [MIDDLE + 1, MIDDLE + reach], PATH);
  pave(cells, [MIDDLE - reach, MIDDLE - 1], [MIDDLE + reach, MIDDLE + 1], PATH);
  stampItem(cells, "well", [MIDDLE, FLOOR, MIDDLE], 0);
  // Three cottages: two north of the cross path facing it, one south facing back.
  const houses = [
    { x: MIDDLE - 7, z: MIDDLE - 6, turn: 0, stub: [MIDDLE - 3, MIDDLE - 2] },
    { x: MIDDLE + 7, z: MIDDLE - 6, turn: 0, stub: [MIDDLE - 3, MIDDLE - 2] },
    { x: MIDDLE + 7, z: MIDDLE + 6, turn: 2, stub: [MIDDLE + 2, MIDDLE + 3] },
  ] as const;
  for (const house of houses) {
    pave(cells, [house.x, house.stub[0]], [house.x, house.stub[1]], PATH);
    stampItem(cells, "house", [house.x, FLOOR, house.z], house.turn);
  }
  // A garden south-west of the square: tilled rows of crops inside a low log fence.
  const garden = {
    from: [MIDDLE - 10, MIDDLE + 4],
    to: [MIDDLE - 4, MIDDLE + 9],
  } as const;
  pave(cells, garden.from, garden.to, DIRT);
  for (let z = garden.from[1] + 1; z <= garden.to[1]; z += 2) {
    for (let x = garden.from[0] + 1; x < garden.to[0]; x += 1) {
      cells[cellOf(x, FLOOR, z)] =
        CROPS[((z - garden.from[1] - 1) / 2) % CROPS.length];
    }
  }
  const gate = MIDDLE - 7;
  for (let z = garden.from[1] - 1; z <= garden.to[1] + 1; z += 1) {
    for (let x = garden.from[0] - 1; x <= garden.to[0] + 1; x += 1) {
      const edge =
        x === garden.from[0] - 1 ||
        x === garden.to[0] + 1 ||
        z === garden.from[1] - 1 ||
        z === garden.to[1] + 1;
      if (edge && !(x === gate && z === garden.from[1] - 1)) {
        cells[cellOf(x, FLOOR, z)] = LOG;
      }
    }
  }
  pave(cells, [gate, MIDDLE + 2], [gate, MIDDLE + 2], PATH);
  // Lamp posts at the square's corners and beside each path's far end.
  Arr.forEach(
    [
      [MIDDLE - 3, MIDDLE - 3],
      [MIDDLE + 3, MIDDLE - 3],
      [MIDDLE - 3, MIDDLE + 3],
      [MIDDLE + 3, MIDDLE + 3],
      [MIDDLE - 2, MIDDLE - reach + 1],
      [MIDDLE + 2, MIDDLE + reach - 1],
      [MIDDLE - reach + 1, MIDDLE + 2],
      [MIDDLE + reach - 1, MIDDLE - 2],
    ] as const,
    ([x, z]) => stampItem(cells, "lamp", [x, FLOOR, z], 0)
  );
  stampItem(cells, "tree", [MIDDLE - 5, FLOOR, MIDDLE - 12], 0);
  stampItem(cells, "tree", [MIDDLE + 5, FLOOR, MIDDLE + 12], 0);
}

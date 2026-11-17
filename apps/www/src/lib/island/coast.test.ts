// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr } from "effect";
import { COAST_STEPS, coastOf } from "@/lib/island/coast";
import { terrainOf } from "@/lib/island/terrain";
import { blockAt, cellOf, emptyCells, SEA_LEVEL } from "@/lib/island/world";

const SAND = idOf("sand");
const WATER = idOf("water");

/** A world of open sea two blocks deep, with sand raised to the water's face on each of these columns. */
function seaWith(land: readonly (readonly [number, number])[]) {
  const cells = emptyCells();
  Arr.forEach(
    Arr.makeBy(SPAN * SPAN, (index) => index),
    (index) => {
      const [x, z] = [index % SPAN, Math.floor(index / SPAN)];
      cells[cellOf(x, SEA_LEVEL - 3, z)] = SAND;
      cells[cellOf(x, SEA_LEVEL - 2, z)] = WATER;
      cells[cellOf(x, SEA_LEVEL - 1, z)] = WATER;
    }
  );
  Arr.forEach(land, ([x, z]) => {
    cells[cellOf(x, SEA_LEVEL - 2, z)] = SAND;
    cells[cellOf(x, SEA_LEVEL - 1, z)] = SAND;
  });
  return cells;
}

/** The coast map's distance at a column, in blocks, and whether its water lies still. */
const at = (coast: Uint8Array, x: number, z: number) => ({
  far: coast[(z * SPAN + x) * 2] / COAST_STEPS,
  still: coast[(z * SPAN + x) * 2 + 1] === 255,
});

describe("island/coast", () => {
  it("measures how far each column lies from the nearest land, round corners as open water does", () => {
    const coast = coastOf(seaWith([[30, 30]]));
    expect(at(coast, 30, 30).far).toBe(0);
    expect(at(coast, 31, 30).far).toBe(1);
    expect(at(coast, 31, 31).far).toBeCloseTo(Math.SQRT2, 1);
    expect(at(coast, 34, 30).far).toBe(4);
    // Past sixteen blocks the map tells only that the water lies far from land.
    expect(at(coast, 0, 0).far).toBeCloseTo(255 / COAST_STEPS);
  });

  it("counts a column as land only when its top stands at the water's face, never under it or dug out", () => {
    const cells = seaWith([]);
    cells[cellOf(10, SEA_LEVEL - 2, 10)] = SAND;
    // A column dug out to nothing holds no land either.
    Arr.forEach(
      Arr.makeBy(SEA_LEVEL, (y) => y),
      (y) => {
        cells[cellOf(12, y, 12)] = 0;
      }
    );
    const coast = coastOf(cells);
    expect(at(coast, 10, 10).far).toBeGreaterThan(0);
    expect(at(coast, 12, 12).far).toBeGreaterThan(0);
  });

  it("lets water lie still where land closes it in, and keeps the open sea rolling", () => {
    const ring = Arr.flatMap(
      Arr.makeBy(5, (step) => step + 20),
      (along) => [
        [along, 20] as const,
        [along, 24] as const,
        [20, along] as const,
        [24, along] as const,
      ]
    );
    const coast = coastOf(seaWith(ring));
    expect(at(coast, 22, 22).still).toBe(true);
    expect(at(coast, 10, 10).still).toBe(false);
    expect(at(coast, 20, 20).still).toBe(false);
  });

  it("stills the home island's pond and lets the sea round it roll", () => {
    const cells = terrainOf(7, 52);
    const coast = coastOf(cells);
    // The pond: water a block under the meadow, well inside the shore.
    const pond = Arr.filter(
      Arr.makeBy(
        SPAN * SPAN,
        (index) => [index % SPAN, Math.floor(index / SPAN)] as const
      ),
      ([x, z]) =>
        Math.hypot(x + 0.5 - SPAN / 2, z + 0.5 - SPAN / 2) < 21 &&
        blockAt(cells, x, SEA_LEVEL - 1, z) === WATER &&
        blockAt(cells, x, SEA_LEVEL, z) === 0
    );
    expect(pond.length).toBeGreaterThan(4);
    Arr.forEach(pond, ([x, z]) => expect(at(coast, x, z).still).toBe(true));
    expect(at(coast, 0, 0).still).toBe(false);
  });
});

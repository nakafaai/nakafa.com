// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import {
  highlandOf,
  layStream,
  pondBearing,
  ROCK,
  riseOf,
} from "@/lib/island/relief";
import { terrainOf } from "@/lib/island/terrain";
import { blockAt, cellOf, emptyCells, SEA_LEVEL } from "@/lib/island/world";

const WATER = idOf("water");
const STONE = idOf("stone");
const MIDDLE = SPAN / 2;

/** Every column of the world. */
const COLUMNS = Arr.makeBy(
  SPAN * SPAN,
  (index) => [index % SPAN, Math.floor(index / SPAN)] as const
);

/** The column `away` cells from the middle on a bearing, in the pond bearing's own sense. */
const toward = (bearing: number, away: number) =>
  [
    Math.floor(MIDDLE + Math.cos(bearing) * away),
    Math.floor(MIDDLE - Math.sin(bearing) * away),
  ] as const;

/** The highest cell of ground or water in a column. */
const topOf = (cells: Uint8Array, x: number, z: number) =>
  Arr.findFirst(
    Arr.makeBy(SPAN / 2, (index) => SPAN / 2 - 1 - index),
    (y) =>
      Arr.contains(
        [STONE, WATER, idOf("grass"), idOf("sand"), idOf("dirt")],
        blockAt(cells, x, y, z)
      )
  );

describe("island/relief", () => {
  it("raises the highland on the side of the island away from its pond, easing away to either flank", () => {
    const away = pondBearing(7) + Math.PI;
    const [hx, hz] = toward(away, 24);
    const [px, pz] = toward(pondBearing(7), 24);
    expect(highlandOf(7, hx, hz)).toBeGreaterThan(0.95);
    expect(highlandOf(7, px, pz)).toBe(0);
    const [fx, fz] = toward(away + 0.6, 24);
    expect(highlandOf(7, fx, fz)).toBeGreaterThan(0);
    expect(highlandOf(7, fx, fz)).toBeLessThan(0.5);
  });

  it("climbs from the meadow to a crest midway and falls to a cliff, in whole terraces two blocks high", () => {
    const rises = Arr.makeBy(13, (step) =>
      riseOf(7, 40, 40, 1, 20 + step, [20, 32])
    );
    expect(rises[0]).toBe(0);
    Arr.forEach(rises, (rise) => expect(rise % 2).toBe(0));
    const crest = Math.max(...rises);
    expect(crest).toBeGreaterThanOrEqual(6);
    const at = Option.getOrElse(
      Arr.findFirstIndex(rises, (rise) => rise === crest),
      () => -1
    );
    expect(at).toBeGreaterThan(2);
    expect(at).toBeLessThan(10);
    expect(rises[12]).toBeGreaterThan(0);
    expect(rises[12]).toBeLessThan(crest);
    expect(riseOf(7, 40, 40, 0, 26, [20, 32])).toBe(0);
    expect(riseOf(7, 40, 40, 1, 26, [20, 18])).toBe(0);
  });

  it("tops the highland's tallest terraces in bare stone and keeps the meadow flat", () => {
    const cells = terrainOf(2026, 52);
    const peaks = Arr.filter(
      COLUMNS,
      ([x, z]) => blockAt(cells, x, SEA_LEVEL + ROCK, z) === STONE
    );
    expect(peaks.length).toBeGreaterThan(5);
    Arr.forEach(COLUMNS, ([x, z]) => {
      if (Math.hypot(x + 0.5 - MIDDLE, z + 0.5 - MIDDLE) < 19) {
        expect(blockAt(cells, x, SEA_LEVEL + 2, z) === STONE).toBe(false);
      }
    });
  });

  it("runs a stream from a tarn on the highland down its terraces, falling at each drop, to the sea", () => {
    const cells = terrainOf(2026, 52);
    // Out past the village, whose well holds water of its own.
    const high = Arr.filter(
      COLUMNS,
      ([x, z]) =>
        Math.hypot(x + 0.5 - MIDDLE, z + 0.5 - MIDDLE) >= 17 &&
        Arr.some(
          Arr.makeBy(9, (lift) => SEA_LEVEL + lift),
          (y) => blockAt(cells, x, y, z) === WATER
        )
    );
    expect(high.length).toBeGreaterThan(15);
    // A fall: a column holding water three cells deep above the sea, where the stream drops a terrace.
    const falls = Arr.filter(COLUMNS, ([x, z]) =>
      Arr.some(
        Arr.makeBy(10, (lift) => SEA_LEVEL + lift),
        (y) =>
          Arr.every([0, 1, 2], (up) => blockAt(cells, x, y + up, z) === WATER)
      )
    );
    expect(falls.length).toBeGreaterThan(1);
    // Every column of the stream stands beside another, so it runs as one stream.
    Arr.forEach(high, ([x, z]) => {
      const beside = Arr.some(
        high,
        ([ox, oz]) => Math.abs(ox - x) + Math.abs(oz - z) === 1
      );
      expect(beside).toBe(true);
    });
    // No tree grows in it.
    Arr.forEach(high, ([x, z]) =>
      Option.match(topOf(cells, x, z), {
        onNone: () => undefined,
        onSome: (top) =>
          expect(blockAt(cells, x, top + 1, z)).not.toBe(idOf("log")),
      })
    );
  });

  it("raises no stream on a world with no highland, and runs one off a knoll and over a level plateau", () => {
    const meadows = new Int8Array(SPAN * SPAN);
    expect(layStream(emptyCells(), meadows, 7)).toEqual([]);
    // A level plateau with one knoll two blocks over it on the highland's side, where the stream rises.
    const plateau = emptyCells();
    const [kx, kz] = toward(pondBearing(7) + Math.PI, 24);
    Arr.forEach(COLUMNS, ([x, z]) => {
      const top = x === kx && z === kz ? SEA_LEVEL + 7 : SEA_LEVEL + 5;
      Arr.forEach(
        Arr.makeBy(top + 1, (y) => y),
        (y) => {
          plateau[cellOf(x, y, z)] = STONE;
        }
      );
    });
    const stream = layStream(plateau, meadows, 7);
    expect(stream.length).toBeGreaterThan(5);
    expect(stream[0]).toEqual([kx, kz]);
    Arr.forEach(Arr.drop(stream, 1), ([x, z]) => {
      expect(blockAt(plateau, x, SEA_LEVEL + 5, z)).toBe(WATER);
      expect(meadows[z * SPAN + x]).toBe(-1);
    });
  });

  it("ends a stream where it rises when trees ring it and the village lies behind it", () => {
    // A spring just outside the village's clearance, a tree on each column beside it outside the clearance too.
    const cells = emptyCells();
    const bearing = pondBearing(7) + Math.PI;
    const [sx, sz] = toward(bearing, 17.6);
    const raise = (x: number, z: number, top: number) =>
      Arr.forEach(
        Arr.makeBy(top + 1, (y) => y),
        (y) => {
          cells[cellOf(x, y, z)] = STONE;
        }
      );
    raise(sx, sz, SEA_LEVEL + 6);
    const around = Arr.filter(
      [
        [sx + 1, sz],
        [sx - 1, sz],
        [sx, sz + 1],
        [sx, sz - 1],
      ] as const,
      ([x, z]) => Math.hypot(x + 0.5 - MIDDLE, z + 0.5 - MIDDLE) >= 17
    );
    Arr.forEach(around, ([x, z]) => {
      raise(x, z, SEA_LEVEL + 5);
      cells[cellOf(x, SEA_LEVEL + 6, z)] = idOf("log");
    });
    expect(layStream(cells, new Int8Array(SPAN * SPAN), 7)).toEqual([[sx, sz]]);
  });
});

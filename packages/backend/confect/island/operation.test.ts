import { describe, expect, it } from "@effect/vitest";
import type { Chunk } from "@repo/backend/confect/island/chunk";
import {
  bareChunk,
  chunkKeyOf,
  isBare,
  MAX_CHUNKS,
  MAX_THINGS,
} from "@repo/backend/confect/island/chunk";
import {
  applyOperation,
  Operation,
  settle,
} from "@repo/backend/confect/island/operation";
import { Array as Arr, HashMap, Option, Schema } from "effect";

const lift = (index: number, eighths: number) => index * 256 + eighths + 128;
const paint = (index: number, surface: number) => index * 8 + surface;
const clear = (index: number, flag: number) => index * 2 + flag;

/** A stroke over one chunk. */
const land = (
  cx: number,
  cz: number,
  lifts: readonly number[],
  paints: readonly number[] = [],
  clears: readonly number[] = []
) => ({ _tag: "land" as const, clears, cx, cz, lifts, paints });

/** A thing set at a place of the chunk at the origin. */
const set = (at: number, kind: "bush" | "cottage" = "bush", cx = 0) => ({
  _tag: "set" as const,
  at,
  cx,
  cz: 0,
  kind,
  turn: 1,
});

const take = (at: number, cx = 0) => ({ _tag: "take" as const, at, cx, cz: 0 });

/** A chunk that holds as many things as one may. */
const crowded = (): Chunk => ({
  ...bareChunk(),
  things: Arr.makeBy(MAX_THINGS, (at) => ({
    at,
    kind: "bush" as const,
    turn: 0,
  })),
});

const NO_CHUNKS = HashMap.empty<number, Chunk>();

describe("island/operation", () => {
  it("sets the points a stroke names, the last write to a point winning, and leaves the bytes it read alone", () => {
    const bare = bareChunk();
    const { chunk, outcome } = applyOperation(
      bare,
      land(
        0,
        0,
        [lift(0, -127), lift(1023, 127), lift(3, 8), lift(3, -8)],
        [paint(5, 2), paint(1023, 5)],
        [clear(9, 1), clear(9, 1), clear(1023, 1), clear(8, 0)]
      ),
      []
    );
    expect(outcome).toBe("done");
    const lifts = new Int8Array(chunk.lifts);
    expect([lifts[0], lifts[3], lifts[1023]]).toEqual([-127, -8, 127]);
    const paints = new Uint8Array(chunk.paints);
    expect([paints[5], paints[1023]]).toEqual([2, 5]);
    const clears = new Uint8Array(chunk.clears);
    expect([clears[1], clears[127]]).toEqual([2, 128]);
    expect(isBare(bare)).toBe(true);
    const undone = applyOperation(
      chunk,
      land(
        0,
        0,
        [lift(0, 0), lift(1023, 0), lift(3, 0)],
        [paint(5, 0), paint(1023, 0)],
        [clear(9, 0), clear(1023, 0)]
      ),
      []
    );
    expect(isBare(undone.chunk)).toBe(true);
  });

  it("sets a thing over whatever stands at its place, takes one away, and locks a blueprint not opened", () => {
    const placed = applyOperation(bareChunk(), set(70), []).chunk;
    expect(placed.things).toEqual([{ at: 70, kind: "bush", turn: 1 }]);
    const locked = applyOperation(placed, set(70, "cottage"), []);
    expect(locked).toEqual({ chunk: placed, outcome: "locked" });
    const replaced = applyOperation(placed, set(70, "cottage"), ["cottage"]);
    expect(replaced.chunk.things).toEqual([
      { at: 70, kind: "cottage", turn: 1 },
    ]);
    expect(applyOperation(replaced.chunk, take(70), []).chunk.things).toEqual(
      []
    );
    // Nothing stands there: taking it is done all the same.
    expect(applyOperation(placed, take(71), [])).toEqual({
      chunk: placed,
      outcome: "done",
    });
  });

  it("refuses a thing at a new place of a chunk that holds 192, and still replaces one of them", () => {
    const full = crowded();
    expect(applyOperation(full, set(4095), [])).toEqual({
      chunk: full,
      outcome: "full",
    });
    const replaced = applyOperation(full, set(5), []);
    expect(replaced.outcome).toBe("done");
    expect(replaced.chunk.things).toHaveLength(MAX_THINGS);
    expect(Arr.last(replaced.chunk.things)).toEqual(
      Option.some({ at: 5, kind: "bush", turn: 1 })
    );
  });

  it("applies a batch in order, a refused operation alone changing nothing", () => {
    const settled = settle(
      NO_CHUNKS,
      0,
      [],
      [
        land(0, 0, [lift(4, 16)]),
        set(9, "cottage"),
        land(0, 0, [lift(4, -16)]),
        set(9),
        land(-1, 2, [], [paint(0, 3)]),
        take(3, 7),
      ]
    );
    expect(settled.outcomes).toEqual([
      "done",
      "locked",
      "done",
      "done",
      "done",
      "done",
    ]);
    expect(settled.count).toBe(2);
    expect(HashMap.size(settled.chunks)).toBe(2);
    const home = Option.getOrThrow(
      HashMap.get(settled.chunks, chunkKeyOf(0, 0))
    );
    expect(new Int8Array(home.lifts)[4]).toBe(-16);
    expect(home.things).toEqual([{ at: 9, kind: "bush", turn: 1 }]);
  });

  it("drops a chunk left with no change and counts it out, which frees its place for another", () => {
    const stored = HashMap.make([
      chunkKeyOf(0, 0),
      applyOperation(bareChunk(), set(1), []).chunk,
    ]);
    const full = settle(stored, MAX_CHUNKS, [], [set(1, "bush", 1)]);
    expect(full.outcomes).toEqual(["full"]);
    expect(full.chunks).toBe(stored);
    expect(full.count).toBe(MAX_CHUNKS);
    const settled = settle(
      stored,
      MAX_CHUNKS,
      [],
      [set(2), take(1), take(2), set(1, "bush", 1), set(1, "bush", 2)]
    );
    expect(settled.outcomes).toEqual(["done", "done", "done", "done", "full"]);
    expect(settled.count).toBe(MAX_CHUNKS);
    expect(Arr.fromIterable(HashMap.keys(settled.chunks))).toEqual([
      chunkKeyOf(1, 0),
    ]);
  });

  it("refuses numbers outside a chunk before any rule runs", () => {
    const accepts = (operation: unknown) =>
      Option.isSome(Schema.decodeUnknownOption(Operation)(operation));
    expect(accepts(land(-4096, 4095, [lift(1023, 127)], [paint(0, 5)]))).toBe(
      true
    );
    expect(accepts(land(4096, 0, []))).toBe(false);
    expect(accepts(land(0, 0, [lift(0, -128)]))).toBe(false);
    expect(accepts(land(0, 0, [lift(1, -128)]))).toBe(false);
    expect(accepts(land(0, 0, [lift(1024, 0)]))).toBe(false);
    expect(accepts(land(0, 0, [], [paint(0, 6)]))).toBe(false);
    expect(accepts(land(0, 0, [], [], [clear(1024, 0)]))).toBe(false);
    expect(
      accepts(
        land(
          0,
          0,
          Arr.makeBy(1025, () => lift(0, 1))
        )
      )
    ).toBe(false);
    expect(accepts(set(4096))).toBe(false);
    expect(accepts({ ...set(0), turn: 4 })).toBe(false);
    expect(accepts({ ...set(0), kind: "castle" })).toBe(false);
    expect(accepts(take(4095))).toBe(true);
  });
});

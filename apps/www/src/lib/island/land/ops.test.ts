// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import type { Chunk as Stored } from "@repo/backend/confect/island/chunk";
import { bareChunk, chunkKeyOf } from "@repo/backend/confect/island/chunk";
import { Operation, settle } from "@repo/backend/confect/island/operation";
import { Array as Arr, HashMap, MutableHashMap, Option, Schema } from "effect";
import type { Change } from "@/lib/island/land/changes";
import {
  applyChanges,
  pointTo,
  thingTo,
  undoneOf,
} from "@/lib/island/land/changes";
import { CHUNK, keyOf, PAINT, POINTS } from "@/lib/island/land/chunk";
import {
  clearedOf,
  LIFT_LIMIT,
  liftOf,
  paintOf,
} from "@/lib/island/land/edits";
import { floraOf } from "@/lib/island/land/flora";
import type { Land } from "@/lib/island/land/ground";
import { chunkAt, heightAt, landOf } from "@/lib/island/land/ground";
import { homeOf } from "@/lib/island/land/home";
import { layChunk, opsOf } from "@/lib/island/land/ops";
import { dabChanges } from "@/lib/island/land/stroke";

const SEED = 4242;

/** The lattice point every world of the seed opens on. */
const [HOME_X, HOME_Z] = homeOf(SEED);

/** The chunk the seed's home lies in. */
const HOME_CHUNK = [
  Math.floor(HOME_X / CHUNK),
  Math.floor(HOME_Z / CHUNK),
] as const;

const decoded = Schema.decodeUnknownSync(Operation);

/** An operation as the server reads it; the test fails where the server would refuse it. */
function accepted(operation: Operation) {
  return decoded(operation);
}

/** Makes changes one after another, each from the land the ones before it left, and answers them as one step. */
function stepOf(
  land: Land,
  makers: readonly ((land: Land) => readonly Change[])[]
) {
  return Arr.flatMap(makers, (make) => {
    const changes = make(land);
    applyChanges(land, changes);
    return changes;
  });
}

/** A chunk's coordinates. */
type Place = readonly [number, number];

/** The chunks a batch of operations names, each once. */
function chunksOf(operations: readonly Operation[]) {
  const places = Arr.map(
    operations,
    (operation): Place => [operation.cx, operation.cz]
  );
  return Arr.dedupeWith(
    places,
    (one: Place, other: Place) => one[0] === other[0] && one[1] === other[1]
  );
}

/** A fresh land of the seed with what the server stores of some chunks laid over it. */
function laidOf(
  stored: HashMap.HashMap<number, Stored>,
  chunks: readonly Place[]
) {
  const land = landOf(SEED);
  for (const [cx, cz] of chunks) {
    Option.map(HashMap.get(stored, chunkKeyOf(cx, cz)), (chunk) =>
      layChunk(land, { ...chunk, cx, cz })
    );
  }
  return land;
}

/** Everything a land holds of one chunk: each point's lift, paint and clearing, the things set down in it, and the ground and water it grows from them. */
function heldOf(land: Land, cx: number, cz: number) {
  const points = Arr.makeBy(
    POINTS,
    (point) =>
      [
        cx * CHUNK + (point % CHUNK),
        cz * CHUNK + Math.floor(point / CHUNK),
      ] as const
  );
  const chunk = chunkAt(land, cx, cz);
  return {
    clears: Arr.map(points, ([i, j]) => clearedOf(land, i, j)),
    ground: [...chunk.heights, ...chunk.surfaces],
    lifts: Arr.map(points, ([i, j]) => liftOf(land, i, j)),
    paints: Arr.map(points, ([i, j]) => paintOf(land, i, j)),
    things: Option.getOrElse(
      MutableHashMap.get(land.things, keyOf(cx, cz)),
      () => []
    ),
  };
}

/** Expects two lands to hold the same of one chunk: the changes exactly, the ground to within what adding eighths one at a time rounds away. */
function expectSame(one: Land, other: Land, cx: number, cz: number) {
  const [held, wanted] = [heldOf(one, cx, cz), heldOf(other, cx, cz)];
  expect({ ...held, ground: [] }).toEqual({ ...wanted, ground: [] });
  expect(
    Arr.every(
      held.ground,
      (value, at) => Math.abs(value - wanted.ground[at]) < 1e-4
    )
  ).toBe(true);
}

/** A step a learner might make about their home: strokes of every brush over a chunk's corner, and things set, turned and taken. */
function playedOn(land: Land) {
  const [cx, cz] = HOME_CHUNK;
  const [x, z] = [(cx + 1) * CHUNK, cz * CHUNK];
  const [plant] = floraOf(land, cx, cz);
  const bench = { at: 70, kind: "bench", turn: 3 } as const;
  return stepOf(land, [
    (now) => dabChanges(now, "raise", x, z, 0),
    (now) => dabChanges(now, "raise", x + 0.5, z, 0),
    (now) => dabChanges(now, "lower", x - 6, z + 6, 0),
    (now) => dabChanges(now, "path", HOME_X, HOME_Z, 0),
    (now) => dabChanges(now, "pond", HOME_X - 6, HOME_Z, 0),
    (now) => dabChanges(now, "meadow", HOME_X - 6, HOME_Z + 1, 0),
    (now) => dabChanges(now, "clear", plant.x, plant.z, 0),
    (now) => [thingTo(now, cx, cz, 70, Option.some(bench))],
    (now) => [thingTo(now, cx, cz, 70, Option.some({ ...bench, turn: 0 }))],
    (now) => [
      thingTo(
        now,
        cx + 1,
        cz,
        4095,
        Option.some({ at: 4095, kind: "cottage", turn: 2 })
      ),
    ],
    (now) => [
      thingTo(
        now,
        cx,
        cz,
        200,
        Option.some({ at: 200, kind: "lantern", turn: 1 })
      ),
    ],
    (now) => [thingTo(now, cx, cz, 200, Option.none())],
  ]);
}

describe("island/land/ops", () => {
  it("tells the server of a stroke as one operation a chunk, naming each point once with what it holds now", () => {
    const land = landOf(SEED);
    const step = stepOf(land, [
      (now) => dabChanges(now, "raise", 0, 0, 0),
      (now) => dabChanges(now, "raise", 0.5, -0.5, 0),
      (now) => dabChanges(now, "lower", -2, 1, 0),
    ]);
    const operations = opsOf(step);
    expect(chunksOf(operations)).toHaveLength(4);
    expect(operations).toHaveLength(4);
    for (const operation of operations) {
      expect(operation._tag).toBe("land");
      expect(accepted(operation)).toEqual(operation);
    }
    const lifted = Arr.flatMap(operations, (operation) =>
      operation._tag === "land"
        ? Arr.map(operation.lifts, (code) => {
            const point = Math.floor(code / 256);
            return {
              i: operation.cx * CHUNK + (point % CHUNK),
              j: operation.cz * CHUNK + Math.floor(point / CHUNK),
              lift: (code % 256) - 128,
            };
          })
        : []
    );
    expect(lifted.length).toBeLessThan(step.length);
    expect(
      Arr.dedupeWith(
        lifted,
        (one, other) => one.i === other.i && one.j === other.j
      )
    ).toHaveLength(lifted.length);
    for (const point of lifted) {
      expect(point.lift).toBe(liftOf(land, point.i, point.j));
    }
    expect(Arr.some(lifted, (point) => point.lift < 0)).toBe(true);
    expect(Arr.some(lifted, (point) => point.lift > 3)).toBe(true);
  });

  it("codes the farthest lift either way, every paint and both clearings at a chunk's first and last points as the server accepts them", () => {
    const land = landOf(SEED);
    const [first, last] = [-3 * CHUNK, -2 * CHUNK - 1];
    const step = stepOf(land, [
      (now) => Option.toArray(pointTo(now, "lift", first, first, -LIFT_LIMIT)),
      (now) => Option.toArray(pointTo(now, "lift", last, last, LIFT_LIMIT)),
      (now) => Option.toArray(pointTo(now, "paint", last, last, PAINT.pond)),
      (now) => Option.toArray(pointTo(now, "paint", first, first, PAINT.grass)),
      (now) => Option.toArray(pointTo(now, "clear", last, last, 1)),
      (now) => Option.toArray(pointTo(now, "clear", first, first, 1)),
    ]);
    const made = opsOf(step);
    expect(made).toEqual([
      {
        _tag: "land",
        clears: [(POINTS - 1) * 2 + 1, 1],
        cx: -3,
        cz: -3,
        lifts: [1, POINTS * 256 - 1],
        paints: [(POINTS - 1) * 8 + PAINT.pond, PAINT.grass],
      },
    ]);
    expect(Arr.map(made, accepted)).toEqual(made);
    // Taken back, the same points are named with the nothing they held.
    const unmade = opsOf(undoneOf(step));
    expect(unmade).toEqual([
      {
        _tag: "land",
        clears: [0, (POINTS - 1) * 2],
        cx: -3,
        cz: -3,
        lifts: [(POINTS - 1) * 256 + 128, 128],
        paints: [PAINT.none, (POINTS - 1) * 8 + PAINT.none],
      },
    ]);
    expect(Arr.map(unmade, accepted)).toEqual(unmade);
  });

  it("names the things set and taken in the order they were, after the land", () => {
    const land = landOf(SEED);
    const bench = { at: 70, kind: "bench", turn: 3 } as const;
    const step = stepOf(land, [
      (now) => [thingTo(now, 2, -9, 70, Option.some(bench))],
      (now) => Option.toArray(pointTo(now, "lift", 70, -280, 4)),
      (now) => [thingTo(now, 2, -9, 70, Option.none())],
    ]);
    const operations = opsOf(step);
    expect(operations).toEqual([
      {
        _tag: "land",
        clears: [],
        cx: 2,
        cz: -9,
        lifts: [(8 * CHUNK + 6) * 256 + 132],
        paints: [],
      },
      { _tag: "set", at: 70, cx: 2, cz: -9, kind: "bench", turn: 3 },
      { _tag: "take", at: 70, cx: 2, cz: -9 },
    ]);
    expect(Arr.map(operations, accepted)).toEqual(operations);
  });

  it("reads back from what the server stores the same lifts, paints, clearings, ground and things the learner left", () => {
    const land = landOf(SEED);
    const operations = opsOf(playedOn(land));
    for (const operation of operations) {
      expect(accepted(operation)).toEqual(operation);
    }
    const world = settle(HashMap.empty(), 0, ["cottage"], operations);
    expect(world.outcomes).toEqual(Arr.map(operations, () => "done"));
    const chunks = chunksOf(operations);
    expect(chunks.length).toBeGreaterThan(3);
    expect(world.count).toBe(chunks.length);
    const laid = laidOf(world.chunks, chunks);
    for (const [cx, cz] of chunks) {
      expectSame(laid, land, cx, cz);
    }
    const home = heldOf(laid, HOME_CHUNK[0], HOME_CHUNK[1]);
    expect(home.things).toEqual([{ at: 70, kind: "bench", turn: 0 }]);
    expect(Arr.contains(home.paints, PAINT.path)).toBe(true);
    expect(Arr.contains(home.paints, PAINT.pond)).toBe(true);
    expect(Arr.contains(home.clears, true)).toBe(true);
    expect(Arr.some(home.lifts, (lift) => lift < 0)).toBe(true);
  });

  it("leaves the server nothing to store of a step that is taken back", () => {
    const land = landOf(SEED);
    const step = playedOn(land);
    const made = settle(HashMap.empty(), 0, ["cottage"], opsOf(step));
    const undone = undoneOf(step);
    applyChanges(land, undone);
    const unmade = settle(made.chunks, made.count, ["cottage"], opsOf(undone));
    expect(unmade.count).toBe(0);
    expect(HashMap.size(unmade.chunks)).toBe(0);
    const bare = landOf(SEED);
    for (const [cx, cz] of chunksOf(opsOf(step))) {
      expectSame(land, bare, cx, cz);
    }
  });

  it("lays a stored chunk over land already made, which grows again with it", () => {
    const land = landOf(SEED);
    const before = heightAt(land, -59, 37);
    const stored = bareChunk();
    new Int8Array(stored.lifts)[5 * CHUNK + 5] = 16;
    new Uint8Array(stored.paints)[5 * CHUNK + 5] = PAINT.path;
    new Uint8Array(stored.clears)[1] = 0b1000_0010;
    const things = [{ at: 12, kind: "well", turn: 1 }] as const;
    layChunk(land, { ...stored, cx: -2, cz: 1, things });
    expect(heightAt(land, -59, 37)).toBeCloseTo(before + 2, 5);
    expect(liftOf(land, -59, 37)).toBe(16);
    expect(paintOf(land, -59, 37)).toBe(PAINT.path);
    expect(
      Arr.filter(Arr.range(0, CHUNK - 1), (across) =>
        clearedOf(land, -2 * CHUNK + across, CHUNK)
      )
    ).toEqual([9, 15]);
    expect(MutableHashMap.get(land.things, keyOf(-2, 1))).toEqual(
      Option.some(things)
    );
    // The land keeps its own copy: what the server's bytes become later does not reach it.
    new Int8Array(stored.lifts)[5 * CHUNK + 5] = 0;
    expect(liftOf(land, -59, 37)).toBe(16);
  });
});

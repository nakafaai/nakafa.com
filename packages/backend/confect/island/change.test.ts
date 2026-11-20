import { describe, expect, it } from "@effect/vitest";
import island from "@repo/backend/confect/_generated/refs/island";
import {
  bareChunk,
  MAX_CHUNKS,
  MAX_THINGS,
} from "@repo/backend/confect/island/chunk";
import { islandWorld } from "@repo/backend/test/island";
import { Array as Arr, Effect } from "effect";

const lift = (index: number, eighths: number) => index * 256 + eighths + 128;

/** A stroke that moves points of one chunk. */
const land = (cx: number, cz: number, lifts: readonly number[]) => ({
  _tag: "land" as const,
  clears: [],
  cx,
  cz,
  lifts,
  paints: [],
});

/** A thing set at a place of one chunk. */
const set = (at: number, kind: "bush" | "cottage" = "bush", cx = 0) => ({
  _tag: "set" as const,
  at,
  cx,
  cz: 0,
  kind,
  turn: 0,
});

/** The chunk rows and the island rows as stored. */
const stored = (world: Effect.Success<ReturnType<typeof islandWorld>>) =>
  Effect.promise(() =>
    world.t.run(async (ctx) => ({
      chunks: await ctx.db.query("islandChunks").collect(),
      islands: await ctx.db.query("islands").collect(),
    }))
  );

describe("island/change", () => {
  it.effect(
    "stores what the learner changed by chunk, the last write to a point winning over two calls",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        const first = yield* world.owner.mutation(island.mutations.change, {
          ops: [land(0, 0, [lift(5, 8)]), set(70), land(-1, -9, [lift(0, 1)])],
        });
        expect(first).toEqual(["done", "done", "done"]);
        yield* world.owner.mutation(island.mutations.change, {
          ops: [land(0, 0, [lift(5, -8)])],
        });
        const { chunks, islands } = yield* stored(world);
        expect(islands[0]?.chunks).toBe(2);
        expect(
          Arr.map(chunks, ({ cx, cz, rx, rz, userId }) => ({
            cx,
            cz,
            rx,
            rz,
            userId,
          }))
        ).toEqual([
          { cx: 0, cz: 0, rx: 0, rz: 0, userId: world.ownerId },
          { cx: -1, cz: -9, rx: -1, rz: -2, userId: world.ownerId },
        ]);
        const home = yield* world.owner.query(island.queries.region, {
          rx: 0,
          rz: 0,
          username: null,
        });
        expect(home).toHaveLength(1);
        expect(new Int8Array(home[0]?.lifts ?? new ArrayBuffer(0))[5]).toBe(-8);
        expect(home[0]?.things).toEqual([{ at: 70, kind: "bush", turn: 0 }]);
        const far = yield* world.owner.query(island.queries.region, {
          rx: -1,
          rz: -2,
          username: null,
        });
        expect(Arr.map(far, ({ cx, cz }) => [cx, cz])).toEqual([[-1, -9]]);
      })
  );

  it.effect(
    "refuses one operation alone and writes the others, and nothing for a caller signed out",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        const outcomes = yield* world.owner.mutation(island.mutations.change, {
          ops: [set(1, "cottage"), set(2)],
        });
        expect(outcomes).toEqual(["locked", "done"]);
        // A refused operation on a stored chunk leaves its row as it is.
        expect(
          yield* world.owner.mutation(island.mutations.change, {
            ops: [set(3, "cottage")],
          })
        ).toEqual(["locked"]);
        const { chunks } = yield* stored(world);
        expect(chunks[0]?.things).toEqual([{ at: 2, kind: "bush", turn: 0 }]);
        expect(
          (yield* world.anyone
            .mutation(island.mutations.change, { ops: [set(2)] })
            .pipe(Effect.flip))._tag
        ).toBe("SessionRequired");
        expect(
          (yield* world.owner
            .mutation(island.mutations.change, {
              ops: Arr.makeBy(65, () => set(2)),
            })
            .pipe(Effect.exit))._tag
        ).toBe("Failure");
      })
  );

  it.effect(
    "deletes the row of a chunk left with no change and counts it out",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        yield* world.owner.mutation(island.mutations.change, {
          ops: [set(8), land(0, 0, [lift(1, 4)])],
        });
        expect((yield* stored(world)).islands[0]?.chunks).toBe(1);
        const outcomes = yield* world.owner.mutation(island.mutations.change, {
          ops: [
            { _tag: "take", at: 8, cx: 0, cz: 0 },
            land(0, 0, [lift(1, 0)]),
            // Nothing stands in a chunk nobody changed: no row is made for it.
            { _tag: "take", at: 8, cx: 3, cz: 3 },
          ],
        });
        expect(outcomes).toEqual(["done", "done", "done"]);
        const { chunks, islands } = yield* stored(world);
        expect(chunks).toEqual([]);
        expect(islands[0]?.chunks).toBe(0);
      })
  );

  it.effect(
    "holds at most 4,096 chunks in a world and 192 things in a chunk",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        yield* world.owner.mutation(island.mutations.change, { ops: [] });
        yield* Effect.promise(() =>
          world.t.run(async (ctx) => {
            const row = await ctx.db.query("islands").first();
            if (row === null) {
              return;
            }
            await ctx.db.patch("islands", row._id, { chunks: MAX_CHUNKS });
            await ctx.db.insert("islandChunks", {
              ...bareChunk(),
              cx: 0,
              cz: 0,
              rx: 0,
              rz: 0,
              things: Arr.makeBy(MAX_THINGS, (at) => ({
                at,
                kind: "bush" as const,
                turn: 0,
              })),
              userId: row.userId,
            });
          })
        );
        const outcomes = yield* world.owner.mutation(island.mutations.change, {
          ops: [set(4000), set(5), set(0, "bush", 1), land(0, 9, [lift(0, 1)])],
        });
        expect(outcomes).toEqual(["full", "done", "full", "full"]);
        const { chunks, islands } = yield* stored(world);
        expect(chunks).toHaveLength(1);
        expect(chunks[0]?.things).toHaveLength(MAX_THINGS);
        expect(islands[0]?.chunks).toBe(MAX_CHUNKS);
      })
  );
});

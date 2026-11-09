import { describe, expect, it } from "@effect/vitest";
import island from "@repo/backend/confect/_generated/refs/island";
import { idOf } from "@repo/backend/confect/island/blocks";
import type { Edit } from "@repo/backend/confect/island/world";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { client } from "@repo/backend/test/client";
import { Array as Arr, DateTime, Effect } from "effect";

const NOW = Date.UTC(2026, 10, 8, 3, 0, 0);
const JAKARTA = DateTime.zoneMakeNamedUnsafe("Asia/Jakarta");
const BERLIN = DateTime.zoneMakeNamedUnsafe("Europe/Berlin");

/** One signed-in learner and the test backend. */
const islandWorld = Effect.fn("test.island.world")(function* () {
  vi.useFakeTimers({ now: NOW });
  const t = createConvexTestWithBetterAuth();
  const owner = yield* Effect.promise(() =>
    t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "owner" })
    )
  );
  return {
    owner: client(
      t.withIdentity({ sessionId: owner.sessionId, subject: owner.authUserId })
    ),
    t,
  };
});

describe("island queries and mutations", () => {
  it.effect(
    "opens the learner's island with no cell changed and keeps its zone at theirs",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        const visitor = client(world.t);
        expect(yield* visitor.query(island.queries.own, {})).toBeNull();
        expect(yield* world.owner.query(island.queries.own, {})).toBeNull();
        yield* world.owner.mutation(island.mutations.open, {
          timeZone: JAKARTA,
        });
        expect(yield* world.owner.query(island.queries.own, {})).toEqual({
          badges: [],
          lifetime: 0,
          version: 0,
          world: [],
        });
        yield* world.owner.mutation(island.mutations.open, {
          timeZone: JAKARTA,
        });
        yield* world.owner.mutation(island.mutations.open, {
          timeZone: BERLIN,
        });
        const zones = yield* Effect.promise(() =>
          world.t.run(async (ctx) =>
            Arr.map(
              await ctx.db.query("islands").collect(),
              (row) => row.timeZone
            )
          )
        );
        expect(zones).toEqual(["Europe/Berlin"]);
        expect(
          (yield* visitor
            .mutation(island.mutations.open, { timeZone: BERLIN })
            .pipe(Effect.flip))._tag
        ).toBe("SessionRequired");
      })
  );

  it.effect(
    "builds a batch over the stored edits under the next version, the last write to a cell winning",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        const planks = idOf("planks");
        const first = yield* world.owner.mutation(island.mutations.build, {
          edits: [
            { block: planks, x: 32, y: 9, z: 32 },
            { block: idOf("grass"), x: 31, y: 9, z: 32 },
          ],
          version: 0,
        });
        expect(first).toEqual({ version: 1 });
        yield* world.owner.mutation(island.mutations.build, {
          edits: [{ block: 0, x: 32, y: 9, z: 32 }],
          version: 1,
        });
        const own = yield* world.owner.query(island.queries.own, {});
        expect(own?.version).toBe(2);
        expect(own?.world).toEqual([
          { block: idOf("grass"), x: 31, y: 9, z: 32 },
          { block: 0, x: 32, y: 9, z: 32 },
        ]);
      })
  );

  it.effect(
    "refuses a stale version, a cell outside the footprint, the bedrock and a block the level has not opened",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        const build = (edits: readonly Edit[], version: number) =>
          world.owner
            .mutation(island.mutations.build, { edits, version })
            .pipe(Effect.flip);
        yield* world.owner.mutation(island.mutations.build, {
          edits: [{ block: idOf("dirt"), x: 30, y: 9, z: 30 }],
          version: 0,
        });
        expect(yield* build([], 0)).toMatchObject({
          _tag: "IslandStale",
          version: 1,
        });
        expect(
          yield* build([{ block: idOf("dirt"), x: 2, y: 9, z: 2 }], 1)
        ).toMatchObject({ _tag: "BuildRefused", index: 0, reason: "outside" });
        expect(
          yield* build(
            [
              { block: idOf("dirt"), x: 30, y: 9, z: 31 },
              { block: 0, x: 30, y: 0, z: 30 },
            ],
            1
          )
        ).toMatchObject({ _tag: "BuildRefused", index: 1, reason: "bedrock" });
        expect(
          yield* build([{ block: idOf("lantern"), x: 30, y: 9, z: 31 }], 1)
        ).toMatchObject({ _tag: "BuildRefused", index: 0, reason: "locked" });
        expect(
          (yield* client(world.t)
            .mutation(island.mutations.build, { edits: [], version: 0 })
            .pipe(Effect.flip))._tag
        ).toBe("SessionRequired");
        expect(
          (yield* world.owner.query(island.queries.own, {}))?.version
        ).toBe(1);
      })
  );
});

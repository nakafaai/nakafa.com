import { assert, describe, expect, it } from "@effect/vitest";
import island from "@repo/backend/confect/_generated/refs/island";
import { EMPTY_TALLY } from "@repo/backend/confect/island/schema";
import { client } from "@repo/backend/test/client";
import { ISLAND_NOW, islandWorld } from "@repo/backend/test/island";
import { MASCOT } from "@repo/backend/test/mascot";
import { seedSchoolMember } from "@repo/backend/test/member";
import { DateTime, Effect } from "effect";

const JAKARTA = DateTime.zoneMakeNamedUnsafe("Asia/Jakarta");

describe("island queries", () => {
  it.effect(
    "answers the learner's lifetime Stars and tally without their world, and nothing before an island",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        expect(
          yield* client(world.t).query(island.queries.growth, {})
        ).toBeNull();
        expect(yield* world.owner.query(island.queries.growth, {})).toBeNull();
        yield* world.owner.mutation(island.mutations.open, {
          timeZone: JAKARTA,
        });
        expect(yield* world.owner.query(island.queries.growth, {})).toEqual({
          lifetime: 0,
          tally: EMPTY_TALLY,
        });
      })
  );

  it.effect(
    "reads the learner's own island: who it opens to, their blueprints and the Stars left for more",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        expect(yield* world.anyone.query(island.queries.own, {})).toBeNull();
        expect(yield* world.owner.query(island.queries.own, {})).toBeNull();
        yield* world.owner.mutation(island.mutations.open, {
          timeZone: JAKARTA,
        });
        expect(yield* world.owner.query(island.queries.own, {})).toEqual({
          access: "link",
          balance: 0,
          blueprints: [],
          lifetime: 0,
          tally: EMPTY_TALLY,
        });
        yield* world.owner.mutation(island.mutations.share, {
          access: "public",
        });
        expect((yield* world.owner.query(island.queries.own, {}))?.access).toBe(
          "public"
        );
      })
  );

  it.effect(
    "opens a world at its address with what a visitor needs, and nothing where no world stands",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        const visit = (caller: typeof world.owner, username = "ayu") =>
          caller.query(island.queries.visit, { username });
        expect(yield* visit(world.anyone, "nobody")).toBeNull();
        // A learner who never entered the game has no world yet.
        expect(yield* visit(world.anyone)).toBeNull();
        yield* world.owner.mutation(island.mutations.open, {
          timeZone: JAKARTA,
        });
        yield* Effect.promise(() =>
          world.t.run(async (ctx) => {
            const row = await ctx.db.query("islands").first();
            assert.ok(row, "Expected the island its owner opened.");
            await ctx.db.patch("islands", row._id, { lifetime: 300 });
          })
        );
        const seen = {
          access: "link",
          level: 3,
          mascot: MASCOT,
          name: "Ayu",
          owner: world.ownerId,
        };
        expect(yield* visit(world.anyone)).toEqual({ ...seen, own: false });
        expect(yield* visit(world.visitor)).toEqual({ ...seen, own: false });
        expect(yield* visit(world.owner)).toEqual({ ...seen, own: true });
        // The world stands under the profile, which a school member's own account alone opens (K15).
        yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            seedSchoolMember(ctx, world.ownerId, ISLAND_NOW)
          )
        );
        expect(yield* visit(world.anyone)).toBeNull();
        expect(yield* visit(world.visitor)).toBeNull();
        expect(yield* visit(world.owner)).toEqual({ ...seen, own: true });
      })
  );

  it.effect(
    "reads the changed chunks of a region for the owner, and for a visitor only while the world opens",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        const region = (
          caller: typeof world.owner,
          username: string | null,
          rx = 0
        ) => caller.query(island.queries.region, { rx, rz: 0, username });
        expect(yield* region(world.anyone, null)).toEqual([]);
        expect(yield* region(world.anyone, "ayu")).toEqual([]);
        yield* world.owner.mutation(island.mutations.change, {
          ops: [
            { _tag: "set", at: 4, cx: 7, cz: 0, kind: "bush", turn: 3 },
            { _tag: "set", at: 4, cx: 8, cz: 0, kind: "bush", turn: 3 },
          ],
        });
        const things = [{ at: 4, kind: "bush", turn: 3 }];
        const own = yield* region(world.owner, null);
        expect(own).toMatchObject([{ cx: 7, cz: 0, things }]);
        expect(own[0]?.lifts.byteLength).toBe(1024);
        expect(own[0]?.paints.byteLength).toBe(1024);
        expect(own[0]?.clears.byteLength).toBe(128);
        expect(yield* region(world.anyone, "ayu", 1)).toMatchObject([
          { cx: 8, cz: 0, things },
        ]);
        expect(yield* region(world.visitor, "ayu")).toMatchObject([{ cx: 7 }]);
        // Without an address a caller reads their own world, which holds nothing here.
        expect(yield* region(world.visitor, null)).toEqual([]);
        yield* world.owner.mutation(island.mutations.share, {
          access: "private",
        });
        expect(yield* region(world.visitor, "ayu")).toEqual([]);
        expect(yield* region(world.owner, "ayu")).toMatchObject([{ cx: 7 }]);
      })
  );

  it.effect(
    "tracks the learner's week in their zone: grants by day, the Stars, and the run of days",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        expect(yield* world.anyone.query(island.queries.week, {})).toBeNull();
        expect(yield* world.owner.query(island.queries.week, {})).toBeNull();
        yield* world.owner.mutation(island.mutations.open, {
          timeZone: JAKARTA,
        });
        // A new island has no run of days yet.
        expect(
          (yield* world.owner.query(island.queries.week, {}))?.streak
        ).toBe(0);
        yield* Effect.promise(() =>
          world.t.run(async (ctx) => {
            const row = await ctx.db.query("islands").first();
            if (row === null) {
              return;
            }
            await ctx.db.patch("islands", row._id, {
              learned: "2026-11-08",
              streak: 3,
            });
            for (const [key, kind, stars] of [
              ["lesson:a", "lesson", 5],
              ["section:s:1", "section", 15],
            ] as const) {
              await ctx.db.insert("islandAwards", {
                day: "2026-11-08",
                key,
                kind,
                stars,
                userId: row.userId,
              });
            }
          })
        );
        const week = yield* world.owner.query(island.queries.week, {});
        expect(week?.today).toBe("2026-11-08");
        expect(week?.streak).toBe(3);
        expect(week?.days).toHaveLength(7);
        expect(week?.days[6]).toEqual({
          day: "2026-11-08",
          lessons: 1,
          sections: 1,
          sets: 0,
          stars: 20,
        });
        expect(week?.days[0]?.day).toBe("2026-11-02");
      })
  );

  it.effect(
    "reads the leaderboard for anyone, the signed-in learner's own row marked",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        yield* world.owner.mutation(island.mutations.open, {
          timeZone: JAKARTA,
        });
        yield* Effect.promise(() =>
          world.t.run(async (ctx) => {
            const row = await ctx.db.query("islands").first();
            assert.ok(row, "Expected the island its owner opened.");
            await ctx.db.patch("islands", row._id, { lifetime: 300 });
          })
        );
        expect(
          yield* world.owner.query(island.queries.leaders, {})
        ).toMatchObject([{ level: 3, lifetime: 300, own: true, place: 1 }]);
        expect(
          yield* world.anyone.query(island.queries.leaders, {})
        ).toMatchObject([{ lifetime: 300, own: false, place: 1 }]);
      })
  );

  it.effect(
    "shows a learner's medals on their profile to whoever may open it, and nothing for a name nobody holds",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        const named = (username: string) =>
          world.anyone.query(island.queries.medals, { username });
        expect(yield* named("nobody")).toBeNull();
        // A learner with no island yet has counted nothing.
        expect(yield* named("ayu")).toEqual({ level: 1, tally: EMPTY_TALLY });
        yield* world.owner.mutation(island.mutations.open, {
          timeZone: JAKARTA,
        });
        const tally = { ...EMPTY_TALLY, days: 3, lessons: 7 };
        yield* Effect.promise(() =>
          world.t.run(async (ctx) => {
            const row = await ctx.db.query("islands").first();
            assert.ok(row, "Expected the island its owner opened.");
            await ctx.db.patch("islands", row._id, { lifetime: 300, tally });
          })
        );
        expect(yield* named("ayu")).toEqual({ level: 3, tally });
        // A school member's profile opens for its own account alone (K15).
        yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            seedSchoolMember(ctx, world.ownerId, ISLAND_NOW)
          )
        );
        expect(yield* named("ayu")).toBeNull();
        expect(
          yield* world.owner.query(island.queries.medals, { username: "ayu" })
        ).toEqual({ level: 3, tally });
      })
  );
});

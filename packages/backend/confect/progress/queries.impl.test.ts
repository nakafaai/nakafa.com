import { describe, expect, it } from "@effect/vitest";
import progress from "@repo/backend/confect/_generated/refs/progress";
import { EMPTY_TALLY } from "@repo/backend/confect/progress/schema";
import { client } from "@repo/backend/test/client";
import { seedSchoolMember } from "@repo/backend/test/member";
import { PROGRESS_NOW, progressWorld } from "@repo/backend/test/progress";
import { Effect } from "effect";

describe("progress queries", () => {
  it.effect(
    "answers the learner's lifetime Stars and tally, and nothing before their first grant",
    () =>
      Effect.gen(function* () {
        const world = yield* progressWorld();
        expect(
          yield* client(world.t).query(progress.queries.growth, {})
        ).toBeNull();
        expect(
          yield* world.owner.query(progress.queries.growth, {})
        ).toBeNull();
        yield* Effect.promise(() =>
          world.t.run(async (ctx) => {
            await ctx.db.insert("progress", {
              lifetime: 0,
              tally: EMPTY_TALLY,
              timeZone: "Asia/Jakarta",
              userId: world.ownerId,
            });
          })
        );
        expect(yield* world.owner.query(progress.queries.growth, {})).toEqual({
          lifetime: 0,
          tally: EMPTY_TALLY,
        });
      })
  );

  it.effect(
    "tracks the learner's week in their zone: grants by day, the Stars, and the run of days",
    () =>
      Effect.gen(function* () {
        const world = yield* progressWorld();
        expect(yield* world.anyone.query(progress.queries.week, {})).toBeNull();
        expect(yield* world.owner.query(progress.queries.week, {})).toBeNull();
        const recordId = yield* Effect.promise(() =>
          world.t.run((ctx) =>
            ctx.db.insert("progress", {
              lifetime: 0,
              tally: EMPTY_TALLY,
              timeZone: "Asia/Jakarta",
              userId: world.ownerId,
            })
          )
        );
        // A new record has no run of days yet.
        expect(
          (yield* world.owner.query(progress.queries.week, {}))?.streak
        ).toBe(0);
        yield* Effect.promise(() =>
          world.t.run(async (ctx) => {
            await ctx.db.patch("progress", recordId, {
              learned: "2026-11-08",
              streak: 3,
            });
            for (const [key, kind, stars] of [
              ["lesson:a", "lesson", 5],
              ["section:s:1", "section", 15],
            ] as const) {
              await ctx.db.insert("progressAwards", {
                day: "2026-11-08",
                key,
                kind,
                stars,
                userId: world.ownerId,
              });
            }
          })
        );
        const week = yield* world.owner.query(progress.queries.week, {});
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
    "reads the leaderboard for anyone, the signed-in learner's own row marked with their profile username",
    () =>
      Effect.gen(function* () {
        const world = yield* progressWorld();
        yield* Effect.promise(() =>
          world.t.run((ctx) =>
            ctx.db.insert("progress", {
              lifetime: 300,
              tally: EMPTY_TALLY,
              timeZone: "Asia/Jakarta",
              userId: world.ownerId,
            })
          )
        );
        expect(
          yield* world.owner.query(progress.queries.leaders, {})
        ).toMatchObject([
          { level: 3, lifetime: 300, own: true, place: 1, username: "ayu" },
        ]);
        expect(
          yield* world.anyone.query(progress.queries.leaders, {})
        ).toMatchObject([
          { lifetime: 300, own: false, place: 1, username: "ayu" },
        ]);
      })
  );

  it.effect(
    "shows a learner's medals on their profile to whoever may open it, and nothing for a name nobody holds",
    () =>
      Effect.gen(function* () {
        const world = yield* progressWorld();
        const named = (username: string) =>
          world.anyone.query(progress.queries.medals, { username });
        expect(yield* named("nobody")).toBeNull();
        // A learner with no progress yet has counted nothing.
        expect(yield* named("ayu")).toEqual({ level: 1, tally: EMPTY_TALLY });
        const tally = { ...EMPTY_TALLY, days: 3, lessons: 7 };
        yield* Effect.promise(() =>
          world.t.run((ctx) =>
            ctx.db.insert("progress", {
              lifetime: 300,
              tally,
              timeZone: "Asia/Jakarta",
              userId: world.ownerId,
            })
          )
        );
        expect(yield* named("ayu")).toEqual({ level: 3, tally });
        // A school member's profile opens for its own account alone (K15).
        yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            seedSchoolMember(ctx, world.ownerId, PROGRESS_NOW)
          )
        );
        expect(yield* named("ayu")).toBeNull();
        expect(
          yield* world.owner.query(progress.queries.medals, { username: "ayu" })
        ).toEqual({ level: 3, tally });
      })
  );
});

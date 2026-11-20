import { assert, describe, expect, it } from "@effect/vitest";
import { grantAward } from "@repo/backend/confect/island/award";
import type { AwardSource } from "@repo/backend/confect/island/schema";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { inMutation } from "@repo/backend/test/client";
import { Array as Arr, DateTime, Effect } from "effect";

/** 03:00 UTC, which is 10:00 in Jakarta, on the day the island landed. */
const NOW = Date.UTC(2026, 10, 8, 3, 0, 0);
const DAY = 86_400_000;

/** One signed-in learner with no island yet, and a way to grant them Stars. */
const learnerWorld = Effect.fn("test.island.learnerWorld")(function* () {
  vi.useFakeTimers({ now: NOW });
  const t = createConvexTestWithAuth();
  const { userId } = yield* Effect.promise(() =>
    t.mutation((ctx) => seedAuthenticatedUser(ctx, { now: NOW }))
  );
  return {
    grant: (source: AwardSource) =>
      Effect.promise(() => t.run(inMutation(() => grantAward(userId, source)))),
    read: () =>
      Effect.promise(() =>
        t.run(async (ctx) => ({
          grants: await ctx.db.query("islandAwards").collect(),
          islands: await ctx.db.query("islands").collect(),
        }))
      ),
    t,
    userId,
  };
});

const lesson = (content: string, subject = "mathematics") =>
  ({ _tag: "lesson", content, subject }) as const;
const set = (name: string) => ({ _tag: "set", set: name }) as const;
const section = (name: string, part: string) =>
  ({ _tag: "section", section: part, set: name }) as const;

describe("island/award", () => {
  it.effect(
    "grants a lesson once and makes the island with its starter set",
    () =>
      Effect.gen(function* () {
        const world = yield* learnerWorld();
        expect(yield* world.grant(lesson("function-concept"))).toEqual({
          _tag: "granted",
          badges: [
            { name: "days", tier: 1 },
            { name: "lessons", tier: 1 },
            { name: "streak", tier: 1 },
            { name: "mathematics", tier: 1 },
          ],
          stars: 5,
        });
        expect(yield* world.grant(lesson("function-concept"))).toEqual({
          _tag: "duplicate",
        });
        const { grants, islands } = yield* world.read();
        expect(grants).toMatchObject([
          {
            day: "2026-11-08",
            key: "lesson:function-concept",
            kind: "lesson",
            stars: 5,
            subject: "mathematics",
          },
        ]);
        expect(islands).toMatchObject([
          {
            learned: "2026-11-08",
            lifetime: 5,
            streak: 1,
            tally: {
              days: 1,
              lessons: 1,
              sections: 0,
              sets: 0,
              streak: 1,
              subjects: { mathematics: 1 },
            },
            timeZone: "UTC",
          },
        ]);
      })
  );

  it.effect(
    "stops lessons at six a day, writing nothing, and grants again the next day",
    () =>
      Effect.gen(function* () {
        const world = yield* learnerWorld();
        for (const index of Arr.range(1, 6)) {
          expect(yield* world.grant(lesson(`lesson-${index}`))).toMatchObject({
            _tag: "granted",
          });
        }
        expect(yield* world.grant(lesson("lesson-7"))).toEqual({
          _tag: "capped",
        });
        expect((yield* world.read()).grants).toHaveLength(6);
        expect((yield* world.read()).islands[0]?.streak).toBe(1);
        vi.setSystemTime(NOW + DAY);
        expect(yield* world.grant(lesson("lesson-7"))).toMatchObject({
          _tag: "granted",
          stars: 5,
        });
        // A lesson the next day carries the run of days on.
        expect((yield* world.read()).islands[0]?.streak).toBe(2);
      })
  );

  it.effect(
    "grants at most 150 Stars a day, giving the last grant what remains",
    () =>
      Effect.gen(function* () {
        const world = yield* learnerWorld();
        for (const name of ["a", "b", "c"]) {
          expect(yield* world.grant(set(name))).toMatchObject({ stars: 40 });
        }
        expect(yield* world.grant(section("d", "one"))).toMatchObject({
          stars: 15,
        });
        expect(yield* world.grant(set("d"))).toMatchObject({ stars: 15 });
        expect(yield* world.grant(section("d", "two"))).toEqual({
          _tag: "capped",
        });
        const { grants, islands } = yield* world.read();
        expect(Arr.map(grants, (grant) => grant.key)).toEqual([
          "set:a",
          "set:b",
          "set:c",
          "section:d:one",
          "set:d",
        ]);
        expect(islands[0]?.lifetime).toBe(150);
      })
  );

  it.effect("counts a grant in the day of the island's zone", () =>
    Effect.gen(function* () {
      const world = yield* learnerWorld();
      yield* world.grant(lesson("first"));
      const jakarta = DateTime.zoneMakeNamedUnsafe("Asia/Jakarta");
      yield* Effect.promise(() =>
        world.t.run(async (ctx) => {
          const island = await ctx.db.query("islands").first();
          assert.ok(island, "Expected the island the first grant made.");
          await ctx.db.patch("islands", island._id, { timeZone: jakarta.id });
        })
      );
      // 18:00 UTC is already 01:00 the next morning in Jakarta.
      vi.setSystemTime(Date.UTC(2026, 10, 8, 18, 0, 0));
      yield* world.grant(lesson("second"));
      const { grants } = yield* world.read();
      expect(Arr.map(grants, (grant) => grant.day)).toEqual([
        "2026-11-08",
        "2026-11-09",
      ]);
    })
  );

  it.effect(
    "names the badge tiers a grant reaches, a day and a run of days once a day",
    () =>
      Effect.gen(function* () {
        const world = yield* learnerWorld();
        const reached = yield* Effect.forEach(Arr.range(0, 4), (day) => {
          vi.setSystemTime(NOW + day * DAY);
          return Effect.map(world.grant(set(`set-${day}`)), (outcome) =>
            outcome._tag === "granted" ? outcome.badges : []
          );
        });
        const tiers = (tier: number) => [
          { name: "days", tier },
          { name: "sets", tier },
          { name: "streak", tier },
        ];
        expect(reached).toEqual([tiers(1), tiers(2), [], [], tiers(3)]);
        // A second grant of a day counts its learning, never the day again.
        expect(yield* world.grant(section("set-4", "one"))).toMatchObject({
          badges: [{ name: "sections", tier: 1 }],
        });
        // A day missed starts the run again and keeps the longest one.
        vi.setSystemTime(NOW + 6 * DAY);
        yield* world.grant(set("set-6"));
        const { islands } = yield* world.read();
        expect(islands[0]).toMatchObject({
          streak: 1,
          tally: {
            days: 6,
            lessons: 0,
            sections: 1,
            sets: 6,
            streak: 5,
            subjects: {},
          },
        });
      })
  );

  it.effect("counts a lesson for its own subject only", () =>
    Effect.gen(function* () {
      const world = yield* learnerWorld();
      yield* world.grant(lesson("physics-1", "physics"));
      yield* world.grant(lesson("data-1", "ai-ds"));
      expect(yield* world.grant(lesson("physics-2", "physics"))).toMatchObject({
        badges: [{ name: "physics", tier: 2 }],
      });
      const { islands } = yield* world.read();
      expect(islands[0]?.tally).toMatchObject({
        lessons: 3,
        subjects: { "ai-ds": 1, physics: 2 },
      });
    })
  );
});

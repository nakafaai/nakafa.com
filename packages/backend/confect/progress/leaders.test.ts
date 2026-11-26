import { describe, expect, it } from "@effect/vitest";
import {
  LEADER_COUNT,
  leadersOf,
} from "@repo/backend/confect/progress/leaders";
import { EMPTY_TALLY } from "@repo/backend/confect/progress/schema";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { inMutation } from "@repo/backend/test/client";
import { seedSchoolMember } from "@repo/backend/test/member";
import { Array as Arr, Effect, Option, Schema } from "effect";

const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);

/** One learner of a test board: their name, optional username, and lifetime Stars. */
const Learner = Schema.Struct({
  lifetime: Schema.Finite,
  name: Schema.String,
  username: Schema.optionalKey(Schema.String),
});

/** Learners with progress records of these lifetime Stars. */
const leaderWorld = Effect.fn("test.progress.leaderWorld")(function* (
  learners: readonly (typeof Learner.Type)[]
) {
  vi.useFakeTimers({ now: NOW });
  const t = createConvexTestWithAuth();
  const ids = yield* Effect.forEach(learners, (learner, index) =>
    Effect.promise(() =>
      t.mutation(async (ctx) => {
        const { userId } = await seedAuthenticatedUser(ctx, {
          name: learner.name,
          now: NOW,
          suffix: `leader-${index}`,
        });
        if (learner.username !== undefined) {
          await ctx.db.patch("users", userId, { username: learner.username });
        }
        await ctx.db.insert("progress", {
          lifetime: learner.lifetime,
          tally: EMPTY_TALLY,
          timeZone: "UTC",
          userId,
        });
        return userId;
      })
    )
  );
  return { ids, t };
});

describe("progress/leaders", () => {
  it.effect(
    "ranks learners by lifetime Stars with profile usernames only when the viewer may open them",
    () =>
      Effect.gen(function* () {
        const { ids, t } = yield* leaderWorld([
          { lifetime: 900, name: "Gone Learner", username: "gone" },
          { lifetime: 500, name: "Budi" },
          { lifetime: 2000, name: "  Ayu Lestari ", username: "ayu" },
          { lifetime: 1500, name: "Dina Putri", username: "dina" },
          { lifetime: 0, name: "Citra", username: "citra" },
        ]);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            await ctx.db.delete(ids[0]);
            await seedSchoolMember(ctx, ids[3], NOW);
          })
        );
        const asBudi = yield* Effect.promise(() =>
          t.run(inMutation(() => leadersOf(Option.some(ids[1]))))
        );
        expect(
          Arr.map(asBudi, (row) => [row.place, row.name, row.own, row.username])
        ).toEqual([
          [1, "Ayu", false, "ayu"],
          [2, "Dina", false, null],
          [3, "Budi", true, null],
        ]);
        expect(asBudi[0].level).toBeGreaterThan(asBudi[2].level);
        expect(asBudi[0].lifetime).toBe(2000);

        // A school member sees their own profile username, while others do not.
        const asDina = yield* Effect.promise(() =>
          t.run(inMutation(() => leadersOf(Option.some(ids[3]))))
        );
        expect(
          Arr.map(asDina, (row) => [row.name, row.own, row.username])
        ).toEqual([
          ["Ayu", false, "ayu"],
          ["Dina", true, "dina"],
          ["Budi", false, null],
        ]);

        const anonymous = yield* Effect.promise(() =>
          t.run(inMutation(() => leadersOf(Option.none())))
        );
        expect(Arr.some(anonymous, (row) => row.own)).toBe(false);
        expect(Arr.map(anonymous, (row) => row.username)).toEqual([
          "ayu",
          null,
          null,
        ]);
      })
  );

  it.effect("shows at most the leaderboard's count", () =>
    Effect.gen(function* () {
      const { t } = yield* leaderWorld(
        Arr.makeBy(LEADER_COUNT + 2, (index) => ({
          lifetime: 100 + index,
          name: `Learner ${index}`,
        }))
      );
      const leaders = yield* Effect.promise(() =>
        t.run(inMutation(() => leadersOf(Option.none())))
      );
      expect(leaders).toHaveLength(LEADER_COUNT);
      expect(leaders[0].lifetime).toBe(100 + LEADER_COUNT + 1);
    })
  );
});

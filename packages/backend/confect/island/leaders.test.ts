import { describe, expect, it } from "@effect/vitest";
import { LEADER_COUNT, leadersOf } from "@repo/backend/confect/island/leaders";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { inMutation } from "@repo/backend/test/client";
import { Array as Arr, Effect, Option } from "effect";

const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);

/** Learners with islands of these lifetime Stars, the first of them deleted after its island was made. */
const leaderWorld = Effect.fn("test.island.leaderWorld")(function* (
  learners: readonly { readonly lifetime: number; readonly name: string }[]
) {
  vi.useFakeTimers({ now: NOW });
  const t = createConvexTestWithBetterAuth();
  const ids = yield* Effect.forEach(learners, (learner, index) =>
    Effect.promise(() =>
      t.mutation(async (ctx) => {
        const { userId } = await seedAuthenticatedUser(ctx, {
          name: learner.name,
          now: NOW,
          suffix: `leader-${index}`,
        });
        await ctx.db.insert("islands", {
          badges: [],
          lifetime: learner.lifetime,
          timeZone: "UTC",
          userId,
          version: 0,
          world: new ArrayBuffer(0),
        });
        return userId;
      })
    )
  );
  return { ids, t };
});

describe("island/leaders", () => {
  it.effect(
    "ranks learners by lifetime Stars, most first, by their first name and level, the viewer's row marked",
    () =>
      Effect.gen(function* () {
        const { ids, t } = yield* leaderWorld([
          { lifetime: 900, name: "Gone Learner" },
          { lifetime: 500, name: "Budi" },
          { lifetime: 2000, name: "  Ayu Lestari " },
          { lifetime: 0, name: "Citra" },
        ]);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            await ctx.db.delete(ids[0]);
          })
        );
        const leaders = yield* Effect.promise(() =>
          t.run(inMutation(() => leadersOf(Option.some(ids[1]))))
        );
        expect(
          Arr.map(leaders, (row) => [row.place, row.name, row.own])
        ).toEqual([
          [1, "Ayu", false],
          [2, "Budi", true],
        ]);
        expect(leaders[0].level).toBeGreaterThan(leaders[1].level);
        expect(leaders[0].lifetime).toBe(2000);
        const anonymous = yield* Effect.promise(() =>
          t.run(inMutation(() => leadersOf(Option.none())))
        );
        expect(Arr.some(anonymous, (row) => row.own)).toBe(false);
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

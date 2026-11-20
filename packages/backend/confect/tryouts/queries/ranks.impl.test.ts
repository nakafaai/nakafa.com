import { assert, describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { seedAuthenticatedUser } from "@repo/backend/confect/test.helpers";
import {
  deleteSetBests,
  recordSetBest,
} from "@repo/backend/confect/tryouts/rank/write";
import { tryoutSetIdentityOf } from "@repo/backend/confect/tryouts/route";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { FIXTURE_TRACK } from "@repo/backend/test/assessment/catalog";
import {
  insertStartedAttempt,
  TRYOUT_NOW,
  type TryoutWorld,
  tryoutWorld,
} from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect } from "effect";

const identity = { ...FIXTURE_TRACK, locale: "id" as const, setKey: "set-1" };

/** Seeds a learner named `name` with a started attempt of the fixture set, and answers the attempt. */
const seedLearner = (world: TryoutWorld, name: string) =>
  Effect.promise(() =>
    world.t.mutation(async (ctx) => {
      const learner = await seedAuthenticatedUser(ctx, {
        name,
        now: TRYOUT_NOW,
        suffix: name.toLowerCase().replaceAll(" ", "-"),
      });
      return insertStartedAttempt(ctx, learner.userId);
    })
  );

/** Records `score` as a finished attempt's score, as the score's finalizer does. */
const score = (
  world: TryoutWorld,
  attemptId: Id<"tryoutAttempts">,
  publishedScore: number
) =>
  world.run(
    Effect.gen(function* () {
      const database = yield* DatabaseReader;
      const attempt = yield* database
        .table("tryoutAttempts")
        .get(attemptId)
        .pipe(Effect.orDie);
      yield* recordSetBest(attempt, {
        finalizedAt: TRYOUT_NOW,
        publishedScore,
      });
    })
  );

describe("tryouts/queries/ranks", () => {
  it.effect("answers an empty board, and the first place for any score", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      expect(
        yield* world.visitor.query(tryouts.queries.ranks.bySet, identity)
      ).toEqual({ count: 0, leaders: [], own: null, standing: null });
      expect(
        yield* world.learner.query(tryouts.queries.ranks.bySet, {
          ...identity,
          score: 500,
        })
      ).toEqual({ count: 0, leaders: [], own: null, standing: 1 });
    })
  );

  it.effect(
    "ranks each learner by their best score, shares a tied place, and marks the viewer's own row",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const { attemptId } = yield* world.start();
        const raka = yield* seedLearner(world, "Raka Pratama");
        const salsa = yield* seedLearner(world, "Salsa");
        yield* score(world, attemptId, 600);
        yield* score(world, raka, 700);
        yield* score(world, salsa, 600);
        // A lower score leaves a best where it stands, and a higher one replaces it.
        yield* score(world, attemptId, 400);
        yield* score(world, raka, 800);

        const board = yield* world.learner.query(tryouts.queries.ranks.bySet, {
          ...identity,
          score: 650,
        });
        expect(board.count).toBe(3);
        expect(board.own).toMatchObject({ own: true, place: 2, score: 600 });
        expect(board.standing).toBe(2);
        expect(board.leaders).toEqual([
          expect.objectContaining({
            name: "Raka",
            own: false,
            place: 1,
            score: 800,
          }),
          expect.objectContaining({ place: 2, score: 600 }),
          expect.objectContaining({ place: 2, score: 600 }),
        ]);
        expect(Arr.filter(board.leaders, (leader) => leader.own)).toEqual([
          expect.objectContaining({ place: 2, score: 600 }),
        ]);
        // Another set's board holds none of them.
        expect(
          yield* world.learner.query(tryouts.queries.ranks.bySet, {
            ...identity,
            setKey: "set-2",
          })
        ).toMatchObject({ count: 0, own: null });
      }),
    15_000
  );

  it.effect(
    "leaves out a learner whose account is gone, and takes a deleted learner's bests off every board",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const { attemptId } = yield* world.start();
        const gone = yield* seedLearner(world, "Dimas");
        yield* score(world, attemptId, 500);
        yield* score(world, gone, 900);
        const goneUser = yield* Effect.promise(() =>
          world.t.mutation(async (ctx) => {
            const attempt = await ctx.db.get("tryoutAttempts", gone);
            assert.ok(attempt, "Expected the attempt.");
            await ctx.db.delete("users", attempt.userId);
            return attempt.userId;
          })
        );
        const board = yield* world.learner.query(
          tryouts.queries.ranks.bySet,
          identity
        );
        expect(board.count).toBe(2);
        expect(board.leaders).toEqual([
          expect.objectContaining({ own: true, place: 2, score: 500 }),
        ]);

        expect(yield* world.run(deleteSetBests(goneUser, 25))).toBe(true);
        expect(yield* world.run(deleteSetBests(goneUser, 25))).toBe(false);
        expect(
          yield* world.learner.query(tryouts.queries.ranks.bySet, identity)
        ).toMatchObject({ count: 1, own: { own: true, place: 1, score: 500 } });
      })
  );

  it.effect("puts a finished attempt on its set's board", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      const { attemptId } = yield* world.start();
      for (const section of ["section-a", "section-b"]) {
        yield* world.startSection(attemptId, section);
        yield* world.completeSection(attemptId, section);
      }
      const best = yield* Effect.promise(() =>
        world.t.query((ctx) =>
          ctx.db
            .query("tryoutSetBests")
            .withIndex("by_userId_and_setIdentity", (query) =>
              query
                .eq("userId", world.userId)
                .eq("setIdentity", tryoutSetIdentityOf(identity))
            )
            .unique()
        )
      );
      expect(best).toMatchObject({ attemptId });
      expect(
        yield* world.learner.query(tryouts.queries.ranks.bySet, identity)
      ).toMatchObject({ count: 1, own: { place: 1 } });
    })
  );
});

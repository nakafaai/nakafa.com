import { Ref } from "@confect/core";
import { assert, describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { FIXTURE_TRACK } from "@repo/backend/test/assessment/snapshot";
import {
  TRYOUT_NOW,
  type TryoutWorld,
  tryoutWorld,
} from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Struct } from "effect";

const identity = { ...FIXTURE_TRACK, locale: "id" as const, setKey: "set-1" };

/**
 * Turns the learner's started attempt into `count` finished attempts of the set, each with a raw
 * score equal to its number, started one millisecond apart.
 */
const seedHistory = (world: TryoutWorld, count: number) =>
  Effect.gen(function* () {
    const { attemptId } = yield* world.start();
    return yield* Effect.promise(() =>
      world.t.mutation(async (ctx) => {
        const template = await ctx.db.get("tryoutAttempts", attemptId);
        assert.ok(template, "Expected the started attempt.");
        await ctx.db.delete("tryoutAttempts", attemptId);
        return Promise.all(
          Arr.map(Arr.range(1, count), async (attemptNumber) => {
            const startedAt = TRYOUT_NOW + attemptNumber;
            const id = await ctx.db.insert("tryoutAttempts", {
              ...Struct.omit(template, ["_creationTime", "_id"]),
              attemptNumber,
              completedAt: startedAt + 1000,
              endReason: "submitted",
              startedAt,
              status: "completed",
            });
            await ctx.db.insert("tryoutScores", {
              assessmentSnapshotId: template.assessmentSnapshotId,
              finalizedAt: startedAt + 1000,
              publishedScore: attemptNumber,
              rawScore: attemptNumber,
              scoreStatus: "official",
              scoringStrategy: "raw",
              setIdentity: template.setIdentity,
              totalCorrect: 0,
              totalQuestions: template.totalQuestions,
              tryoutAttemptId: id,
              userId: template.userId,
            });
            return id;
          })
        );
      })
    );
  });

describe("tryouts/queries/history", () => {
  it.effect(
    "lists a set's attempts newest first with their scores, after a later release renames its route",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const [first, second] = yield* seedHistory(world, 2);
        yield* world.release({ renamed: true });
        const history = yield* world.learner.query(
          tryouts.queries.history.bySet,
          { ...identity, paginationOpts: { cursor: null, numItems: 25 } }
        );
        expect(history.isDone).toBe(true);
        expect(history.page).toEqual([
          expect.objectContaining({
            attemptId: second,
            attemptNumber: 2,
            score: expect.objectContaining({ publishedScore: 2 }),
            status: "completed",
          }),
          expect.objectContaining({
            attemptId: first,
            attemptNumber: 1,
            score: expect.objectContaining({ publishedScore: 1 }),
            status: "completed",
          }),
        ]);
      })
  );

  it.effect(
    "keeps another set's history apart, and reads at most twenty-five attempts a page",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        yield* seedHistory(world, 26);
        expect(
          yield* world.learner.query(tryouts.queries.history.bySet, {
            ...identity,
            paginationOpts: { cursor: null, numItems: 25 },
            setKey: "missing",
          })
        ).toMatchObject({ isDone: true, page: [] });
        const page = yield* world.learner.query(tryouts.queries.history.bySet, {
          ...identity,
          paginationOpts: { cursor: null, numItems: 100 },
        });
        expect(page.isDone).toBe(false);
        expect(page.page).toHaveLength(25);
        expect(page.page[0]?.attemptNumber).toBe(26);
      })
  );

  it.effect("refuses malformed set keys", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      for (const setKey of ["Set-1", "set\0one", "s".repeat(129)]) {
        const refused = yield* Effect.tryPromise(() =>
          world.learnerConvex.query(
            Ref.getFunctionReference(tryouts.queries.history.bySet),
            {
              ...identity,
              paginationOpts: { cursor: null, numItems: 25 },
              setKey,
            }
          )
        ).pipe(Effect.asVoid, Effect.flip);
        expect(refused.cause).toMatchObject({
          data: { code: "TRYOUT_ROUTE_INVALID" },
        });
      }
    })
  );
});

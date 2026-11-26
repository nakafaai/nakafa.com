import { describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { seedAuthenticatedUser } from "@repo/backend/confect/test.helpers";
import { client } from "@repo/backend/test/client";
import { TRYOUT_NOW, tryoutWorld } from "@repo/backend/test/tryout/world";
import { Effect } from "effect";

const { discardAttempt } = tryouts.mutations.attempts;

describe("tryouts/start/discard", () => {
  it.effect(
    "discards an unstarted attempt, deletes its placements, and clears set progress when it was the first attempt",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const started = yield* world.start();

        expect(
          yield* world.learner.mutation(discardAttempt, {
            attemptId: started.attemptId,
          })
        ).toEqual({ discarded: true });

        const remaining = yield* Effect.promise(() =>
          world.t.query(async (ctx) => ({
            attempt: await ctx.db.get("tryoutAttempts", started.attemptId),
            placements: await ctx.db
              .query("tryoutAttemptPlacements")
              .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
                query.eq("tryoutAttemptId", started.attemptId)
              )
              .collect(),
            progress: await ctx.db.query("tryoutSetProgress").collect(),
          }))
        );
        expect(remaining).toEqual({
          attempt: null,
          placements: [],
          progress: [],
        });
      })
  );

  it.effect(
    "restores set progress to the previous completed attempt when discarding a second unstarted attempt",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const first = yield* world.start();
        yield* world.startSection(first.attemptId, "section-a");
        yield* world.completeSection(first.attemptId, "section-a");
        yield* world.startSection(first.attemptId, "section-b");
        yield* world.completeSection(first.attemptId, "section-b");

        const second = yield* world.start();
        expect(second.attemptId).not.toBe(first.attemptId);

        expect(
          yield* world.learner.mutation(discardAttempt, {
            attemptId: second.attemptId,
          })
        ).toEqual({ discarded: true });

        const progress = yield* Effect.promise(() =>
          world.t.query((ctx) => ctx.db.query("tryoutSetProgress").collect())
        );
        expect(progress).toMatchObject([
          {
            attemptNumber: 1,
            latestAttemptId: first.attemptId,
            status: "completed",
          },
        ]);

        // If a prior attempt has no score (e.g. still in-progress), restore skips writing a score row.
        const third = yield* world.start();
        yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            ctx.db.patch("tryoutAttempts", first.attemptId, {
              status: "in-progress",
            })
          )
        );
        expect(
          yield* world.learner.mutation(discardAttempt, {
            attemptId: third.attemptId,
          })
        ).toEqual({ discarded: true });
      })
  );

  it.effect(
    "leaves unrelated set progress intact when progress already points to another attempt",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const first = yield* world.start();
        yield* Effect.promise(() =>
          world.t.mutation(async (ctx) => {
            const rows = await ctx.db.query("tryoutSetProgress").collect();
            for (const row of rows) {
              await ctx.db.delete("tryoutSetProgress", row._id);
            }
          })
        );
        expect(
          yield* world.learner.mutation(discardAttempt, {
            attemptId: first.attemptId,
          })
        ).toEqual({ discarded: true });
      })
  );

  it.effect(
    "refuses discarding an attempt once a section has started, once ended, or by another learner",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const started = yield* world.start();
        const other = yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            seedAuthenticatedUser(ctx, { now: TRYOUT_NOW, suffix: "other" })
          )
        );
        const outsider = client(
          world.t.withIdentity({ subject: other.sessionId })
        );

        expect(
          yield* outsider
            .mutation(discardAttempt, { attemptId: started.attemptId })
            .pipe(Effect.flip)
        ).toMatchObject({ code: "TRYOUT_ATTEMPT_NOT_FOUND" });

        yield* world.startSection(started.attemptId, "section-a");
        expect(
          yield* world.learner
            .mutation(discardAttempt, { attemptId: started.attemptId })
            .pipe(Effect.flip)
        ).toMatchObject({ code: "TRYOUT_ATTEMPT_NOT_ACTIVE" });

        yield* world.completeSection(started.attemptId, "section-a");
        yield* world.startSection(started.attemptId, "section-b");
        yield* world.completeSection(started.attemptId, "section-b");
        expect(
          yield* world.learner
            .mutation(discardAttempt, { attemptId: started.attemptId })
            .pipe(Effect.flip)
        ).toMatchObject({ code: "TRYOUT_ATTEMPT_NOT_ACTIVE" });
      })
  );
});

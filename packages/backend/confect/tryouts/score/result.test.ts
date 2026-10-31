import { assert, describe, expect, it } from "@effect/vitest";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  getSectionScoreResult,
  loadAttemptScoreResult,
} from "@repo/backend/confect/tryouts/score/result";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { type TryoutWorld, tryoutWorld } from "@repo/backend/test/tryout/world";
import { Effect, Result } from "effect";

/** Reads a finished attempt's score and its first section's score, or the code either read fails with. */
const readScores = (world: TryoutWorld, attemptId: Id<"tryoutAttempts">) =>
  world.run(
    Effect.gen(function* () {
      const database = yield* DatabaseReader;
      const attempt = yield* database
        .table("tryoutAttempts")
        .get(attemptId)
        .pipe(Effect.orDie);
      const section = yield* database
        .table("tryoutSectionAttempts")
        .get("by_tryoutAttemptId_and_sectionKey", attemptId, "section-a")
        .pipe(Effect.orDie);
      const codeOf = <A, E extends { readonly code: string }, R>(
        read: Effect.Effect<A, E, R>
      ) =>
        read.pipe(
          Effect.result,
          Effect.map(
            Result.match({
              onFailure: ({ code }) => ({ code }),
              onSuccess: (value) => ({ value }),
            })
          )
        );
      return {
        attempt: yield* codeOf(loadAttemptScoreResult(attempt)),
        section: yield* codeOf(getSectionScoreResult(section)),
      };
    })
  );

describe("tryouts/score/result", () => {
  it.effect(
    "reads a finished IRT attempt's score with its whole estimate, and refuses a missing or partial one",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ scoring: { kind: "irt" } });
        const { attemptId } = yield* world.start();
        for (const sectionKey of ["section-a", "section-b"]) {
          yield* world.startSection(attemptId, sectionKey);
          yield* world.completeSection(attemptId, sectionKey);
        }
        expect(yield* readScores(world, attemptId)).toMatchObject({
          attempt: {
            value: {
              scoringStrategy: "irt",
              theta: expect.any(Number),
              thetaSE: expect.any(Number),
              totalQuestions: 3,
            },
          },
          section: {
            value: { theta: expect.any(Number), totalQuestions: 2 },
          },
        });
        yield* Effect.promise(() =>
          world.t.mutation(async (ctx) => {
            const score = await ctx.db
              .query("tryoutScores")
              .withIndex("by_tryoutAttemptId", (query) =>
                query.eq("tryoutAttemptId", attemptId)
              )
              .unique();
            const section = await ctx.db
              .query("tryoutSectionAttempts")
              .withIndex("by_tryoutAttemptId_and_sectionKey", (query) =>
                query
                  .eq("tryoutAttemptId", attemptId)
                  .eq("sectionKey", "section-a")
              )
              .unique();
            assert.ok(score && section?.score, "Expected the stored scores.");
            await ctx.db.patch("tryoutScores", score._id, { theta: undefined });
            await ctx.db.patch("tryoutSectionAttempts", section._id, {
              score: undefined,
            });
          })
        );
        expect(yield* readScores(world, attemptId)).toEqual({
          attempt: { code: "TRYOUT_SCORE_ESTIMATE_INCOMPLETE" },
          section: { code: "TRYOUT_SECTION_SCORE_NOT_FOUND" },
        });
        yield* Effect.promise(() =>
          world.t.mutation(async (ctx) => {
            for (const score of await ctx.db.query("tryoutScores").collect()) {
              await ctx.db.delete("tryoutScores", score._id);
            }
          })
        );
        expect(yield* readScores(world, attemptId)).toMatchObject({
          attempt: { code: "TRYOUT_SCORE_NOT_FOUND" },
        });
      })
  );
});

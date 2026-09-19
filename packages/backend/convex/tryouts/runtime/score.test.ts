import { describe, expect, it } from "@effect/vitest";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import { loadAttemptPlacements } from "@repo/backend/convex/tryouts/runtime/placement";
import { loadAttemptResponses } from "@repo/backend/convex/tryouts/runtime/response";
import {
  finalizeAttemptScore,
  loadAttemptScoreSource,
  requireOwnedAttempt,
  scoreTryoutSection,
  summarizeResponses,
} from "@repo/backend/convex/tryouts/runtime/score";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import {
  FROZEN_SCORE_NOW as NOW,
  FROZEN_SCORE_SET_IDENTITY as SET_IDENTITY,
  FROZEN_SCORE_SNAPSHOT_ID as SNAPSHOT_ID,
  seedFrozenTryoutScoreState,
} from "@repo/backend/test/tryout/score";
import { convexTest } from "convex-test";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutEndReason = NonNullable<TryoutAttempt["endReason"]>;

/** Finalizes an attempt through the same single placement read as production. */
const finalizeLoadedAttempt = Effect.fn(
  "tryouts.runtime.test.finalizeLoadedAttempt"
)(function* (
  ctx: MutationCtx,
  args: {
    readonly attempt: TryoutAttempt;
    readonly endReason: TryoutEndReason;
    readonly now: number;
  }
) {
  const placements = yield* loadAttemptPlacements(ctx, args.attempt);
  const responseIndex = yield* loadAttemptResponses(
    ctx,
    args.attempt,
    placements,
    "complete"
  );
  const source = yield* loadAttemptScoreSource(
    ctx,
    args.attempt,
    responseIndex.placements
  );

  return yield* finalizeAttemptScore(ctx, { ...args, responseIndex, source });
});

describe("tryouts/runtime/score", () => {
  it("masks unexpected owned attempt lookup failures", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "score-storage",
      })
    );
    const storageCause = new Error("internal tryoutAttempts storage details");
    await t.mutation(async (ctx) => {
      const get = vi.spyOn(ctx.db, "get").mockRejectedValue(storageCause);
      const failure = await runConvexProgram(
        requireOwnedAttempt(ctx, {
          attemptId: seeded.attemptId,
          userId: seeded.identity.userId,
        }).pipe(Effect.flip, Effect.orDie)
      );
      expect(failure).toMatchObject({
        code: "TRYOUT_RUNTIME_FAILED",
        message: "Unable to load try-out attempt.",
      });
      expect(failure.cause).toBeInstanceOf(TryoutRuntimeError);
      expect(failure.cause).toMatchObject({ cause: storageCause });
      await expect(
        runConvexProgram(
          requireOwnedAttempt(ctx, {
            attemptId: seeded.attemptId,
            userId: seeded.identity.userId,
          })
        )
      ).rejects.toMatchObject({
        data: {
          code: "TRYOUT_RUNTIME_FAILED",
          message: "Unable to load try-out attempt.",
        },
      });
      get.mockRestore();
    });
  });

  it.effect(
    "scores from the frozen bundle after the active release advances",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);

        const snapshot = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const attempt = yield* seedFrozenTryoutScoreState(ctx);
                yield* finalizeLoadedAttempt(ctx, {
                  attempt,
                  endReason: "submitted",
                  now: NOW,
                });

                yield* finalizeLoadedAttempt(ctx, {
                  attempt,
                  endReason: "submitted",
                  now: NOW + 1,
                });
                const score = yield* Effect.promise(() =>
                  ctx.db
                    .query("tryoutScores")
                    .withIndex("by_tryoutAttemptId", (query) =>
                      query.eq("tryoutAttemptId", attempt._id)
                    )
                    .unique()
                );
                const finalizedAttempt = yield* Effect.promise(() =>
                  ctx.db.get(attempt._id)
                );

                return { finalizedAttempt, score };
              })
            )
          )
        );

        expect(snapshot.finalizedAttempt).toMatchObject({
          endReason: "submitted",
          status: "completed",
        });
        expect(snapshot.score).toMatchObject({
          publishedScore: 100,
          rawScore: 100,
          scoringStrategy: "raw",
          setIdentity: SET_IDENTITY,
          totalCorrect: 1,
          totalQuestions: 1,
          tryoutSnapshotId: SNAPSHOT_ID,
        });
      })
  );

  it.effect("rejects stale response correctness before terminal writes", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const fixture = yield* Effect.promise(() =>
                seedTryoutContentAccessState(ctx, {
                  attemptStatus: "in-progress",
                  sectionStatus: "in-progress",
                  suffix: "score-response-integrity",
                })
              );
              const placement = yield* Effect.promise(() =>
                ctx.db.get(fixture.placementId)
              );
              if (!placement) {
                return yield* Effect.die(
                  "Expected one frozen try-out placement."
                );
              }
              const choice =
                placement.responseSpec.kind === "single-choice"
                  ? placement.responseSpec.options.at(0)
                  : undefined;
              if (!choice) {
                return yield* Effect.die("Expected one frozen try-out choice.");
              }
              yield* Effect.promise(() =>
                ctx.db.patch(fixture.attemptId, {
                  scoreStatus: "official",
                  scoringStrategy: "raw",
                })
              );
              yield* Effect.promise(() =>
                ctx.db.insert("tryoutResponses", {
                  answeredAt: NOW,
                  isComplete: true,
                  isCorrect: !choice.isCorrect,
                  placementId: placement._id,
                  selection: {
                    kind: "single-choice",
                    optionKey: choice.optionKey,
                  },
                  timeSpent: 0,
                  tryoutAttemptId: fixture.attemptId,
                  tryoutSectionAttemptId: fixture.sectionAttemptId,
                  updatedAt: NOW,
                })
              );
              return fixture;
            })
          )
        )
      );

      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const attempt = yield* Effect.promise(() =>
                  ctx.db.get(seeded.attemptId)
                );
                if (!attempt) {
                  return yield* Effect.die(
                    "Expected one active try-out attempt."
                  );
                }
                return yield* finalizeLoadedAttempt(ctx, {
                  attempt,
                  endReason: "submitted",
                  now: NOW + 1000,
                });
              })
            )
          )
        ).rejects.toMatchObject({
          data: { code: "TRYOUT_RESPONSE_SELECTION_MISMATCH" },
        })
      );

      const stored = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const attempt = yield* Effect.promise(() =>
                ctx.db.get(seeded.attemptId)
              );
              const scores = yield* Effect.promise(() =>
                ctx.db.query("tryoutScores").collect()
              );
              const section = yield* Effect.promise(() =>
                ctx.db.get(seeded.sectionAttemptId)
              );
              return { attempt, scores, section };
            })
          )
        )
      );
      expect(stored.scores).toEqual([]);
      expect(stored.attempt).toMatchObject({
        completedAt: null,
        endReason: null,
        status: "in-progress",
        totalCorrect: 0,
      });
      expect(stored.section).toMatchObject({
        answeredCount: 0,
        correctAnswers: 0,
        status: "in-progress",
      });
    })
  );

  it.effect(
    "rejects duplicate placement identities before terminal writes",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const fixture = yield* Effect.promise(() =>
                  seedTryoutContentAccessState(ctx, {
                    attemptStatus: "in-progress",
                    sectionStatus: "in-progress",
                    suffix: "score-placement-identity",
                  })
                );
                const attempt = yield* Effect.promise(() =>
                  ctx.db.get(fixture.attemptId)
                );
                const placement = yield* Effect.promise(() =>
                  ctx.db.get(fixture.placementId)
                );
                const section = yield* Effect.promise(() =>
                  ctx.db.get(fixture.sectionAttemptId)
                );
                const snapshot = attempt?.sectionSnapshots.at(0);
                if (!(attempt && placement && section && snapshot)) {
                  return yield* Effect.die(
                    "Expected a complete try-out integrity fixture."
                  );
                }

                yield* Effect.promise(() =>
                  ctx.db.patch(attempt._id, {
                    scoreStatus: "official",
                    scoringStrategy: "raw",
                    sectionSnapshots: [{ ...snapshot, questionCount: 2 }],
                    totalQuestions: 2,
                  })
                );
                yield* Effect.promise(() =>
                  ctx.db.patch(section._id, { totalQuestions: 2 })
                );
                const { _creationTime, _id, ...placementValues } = placement;
                yield* Effect.promise(() =>
                  ctx.db.insert("tryoutAttemptPlacements", {
                    ...placementValues,
                    questionOrder: 2,
                  })
                );
                return fixture;
              })
            )
          )
        );

        yield* Effect.promise(() =>
          expect(
            t.mutation((ctx) =>
              runConvexProgram(
                Effect.gen(function* () {
                  const attempt = yield* Effect.promise(() =>
                    ctx.db.get(seeded.attemptId)
                  );
                  if (!attempt) {
                    return yield* Effect.die(
                      "Expected one active try-out attempt."
                    );
                  }
                  return yield* finalizeLoadedAttempt(ctx, {
                    attempt,
                    endReason: "submitted",
                    now: NOW + 1000,
                  });
                })
              )
            )
          ).rejects.toMatchObject({
            data: { code: "TRYOUT_PLACEMENT_DUPLICATE" },
          })
        );

        const stored = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const attempt = yield* Effect.promise(() =>
                  ctx.db.get(seeded.attemptId)
                );
                const progress = yield* Effect.promise(() =>
                  ctx.db.query("tryoutSetProgress").collect()
                );
                const scores = yield* Effect.promise(() =>
                  ctx.db.query("tryoutScores").collect()
                );
                const section = yield* Effect.promise(() =>
                  ctx.db.get(seeded.sectionAttemptId)
                );
                return { attempt, progress, scores, section };
              })
            )
          )
        );
        expect(stored.scores).toEqual([]);
        expect(stored.progress).toEqual([]);
        expect(stored.attempt).toMatchObject({
          completedAt: null,
          endReason: null,
          status: "in-progress",
          totalCorrect: 0,
        });
        expect(stored.section).toMatchObject({
          answeredCount: 0,
          correctAnswers: 0,
          status: "in-progress",
        });
        expect(stored.section?.score).toBeUndefined();
      })
  );
  it.each(
    Object.entries({
      inactive: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      "foreign source": "TRYOUT_SCORE_SOURCE_MISMATCH",
      "wrong strategy": "TRYOUT_SCORE_SOURCE_MISMATCH",
      "progress failure": "TRYOUT_PROGRESS_WRITE_FAILED",
    })
  )("rolls back terminal writes on %s", async (kind, code) => {
    const t = convexTest(schema, convexModules);
    const attempt = await t.mutation((ctx) =>
      runConvexProgram(seedFrozenTryoutScoreState(ctx))
    );
    await expect(
      t.mutation(async (ctx) => {
        const placements = await runConvexProgram(
          loadAttemptPlacements(ctx, attempt)
        );
        const responseIndex = await runConvexProgram(
          loadAttemptResponses(ctx, attempt, placements, "complete")
        );
        const source = await runConvexProgram(
          loadAttemptScoreSource(ctx, attempt, placements)
        );
        if (kind === "foreign source") {
          const { _id, _creationTime, ...values } = attempt;
          const foreignId = await ctx.db.insert("tryoutAttempts", values);
          return runConvexProgram(
            scoreTryoutSection({
              attempt,
              placements,
              responses: [],
              source: { ...source, attemptId: foreignId },
              totalQuestions: 1,
            })
          );
        }
        if (kind === "wrong strategy") {
          return runConvexProgram(
            scoreTryoutSection({
              attempt: { ...attempt, scoringStrategy: "irt" },
              placements,
              responses: [],
              source,
              totalQuestions: 1,
            })
          );
        }
        if (kind === "progress failure") {
          const query = ctx.db.query.bind(ctx.db);
          vi.spyOn(ctx.db, "query")
            .mockImplementationOnce(query)
            .mockImplementationOnce(() => {
              throw new Error("Progress storage unavailable.");
            });
        }
        return runConvexProgram(
          finalizeAttemptScore(ctx, {
            attempt:
              kind === "inactive"
                ? { ...attempt, status: "completed" }
                : attempt,
            endReason: "submitted",
            now: NOW,
            responseIndex,
            source,
          })
        );
      })
    ).rejects.toMatchObject({
      data: {
        code,
      },
    });
    expect(
      await t.query((ctx) => ctx.db.query("tryoutScores").collect())
    ).toEqual([]);
    expect(await t.query((ctx) => ctx.db.get(attempt._id))).toEqual(attempt);
  });

  it("counts only complete responses and distinguishes incorrect answers", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await runConvexProgram(seedFrozenTryoutScoreState(ctx));
      const response = await ctx.db.query("tryoutResponses").unique();
      if (!response) {
        throw new Error("Expected a scored response.");
      }
      expect(
        summarizeResponses([
          response,
          { ...response, isComplete: false },
          { ...response, isCorrect: false },
        ])
      ).toEqual({ answeredCount: 2, correctAnswers: 1 });
    });
  });
});

import { DatabaseReader as ConfectDatabaseReader } from "@confect/server";
import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { convexModules } from "@repo/backend/confect/test.setup";
import { TryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import { loadAttemptPlacements } from "@repo/backend/confect/tryouts/runtime/placement";
import { loadAttemptResponses } from "@repo/backend/confect/tryouts/runtime/response";
import {
  finalizeAttemptScore,
  loadAttemptScoreSource,
  requireOwnedAttempt,
  scoreTryoutSection,
  summarizeResponses,
} from "@repo/backend/confect/tryouts/runtime/score";
import schema from "@repo/backend/convex/schema";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import {
  finalizeLoadedAttempt,
  FROZEN_SCORE_NOW as NOW,
  FROZEN_SCORE_SET_IDENTITY as SET_IDENTITY,
  FROZEN_SCORE_SNAPSHOT_ID as SNAPSHOT_ID,
  seedFrozenTryoutScoreState,
} from "@repo/backend/test/tryout/score";
import { convexTest } from "convex-test";
import { Effect } from "effect";

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
      const failure = await Effect.runPromise(
        requireOwnedAttempt({
          attemptId: seeded.attemptId,
          userId: seeded.identity.userId,
        }).pipe(
          Effect.flip,
          Effect.orDie,
          Effect.provide(mutationLayer(confectSchema, ctx))
        )
      );
      expect(failure).toMatchObject({
        code: "TRYOUT_RUNTIME_FAILED",
        message: "Unable to load try-out attempt.",
      });
      expect(failure).toBeInstanceOf(TryoutRuntimeError);
      expect(failure.cause).toBe(storageCause);
      await expect(
        Effect.runPromise(
          requireOwnedAttempt({
            attemptId: seeded.attemptId,
            userId: seeded.identity.userId,
          }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
        )
      ).rejects.toMatchObject({
        code: "TRYOUT_RUNTIME_FAILED",
        message: "Unable to load try-out attempt.",
      });
      get.mockRestore();
    });
  });
  it.effect(
    "scores from the frozen bundle after the active release advances",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        const snapshot = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              Effect.gen(function* () {
                const attempt = yield* seedFrozenTryoutScoreState(ctx);
                for (const now of [NOW, NOW + 1]) {
                  yield* finalizeLoadedAttempt({
                    attempt,
                    endReason: "submitted",
                    now,
                  });
                }
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
                return {
                  finalizedAttempt,
                  score,
                };
              }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
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
      const runtimeServices = yield* Effect.context<never>();
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
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
            }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
          )
        )
      );
      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              Effect.gen(function* () {
                const attempt = yield* Effect.promise(() =>
                  ctx.db.get(seeded.attemptId)
                );
                if (!attempt) {
                  return yield* Effect.die(
                    "Expected one active try-out attempt."
                  );
                }
                return yield* finalizeLoadedAttempt({
                  attempt,
                  endReason: "submitted",
                  now: NOW + 1000,
                });
              }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
            )
          )
        ).rejects.toMatchObject({
          code: "TRYOUT_RESPONSE_SELECTION_MISMATCH",
        })
      );
      const stored = yield* Effect.promise(() =>
        t.query((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
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
              return {
                attempt,
                scores,
                section,
              };
            }).pipe(
              Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
            )
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
        const runtimeServices = yield* Effect.context<never>();
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
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
                    sectionSnapshots: [
                      {
                        ...snapshot,
                        questionCount: 2,
                      },
                    ],
                    totalQuestions: 2,
                  })
                );
                yield* Effect.promise(() =>
                  ctx.db.patch(section._id, {
                    totalQuestions: 2,
                  })
                );
                const { _creationTime, _id, ...placementValues } = placement;
                yield* Effect.promise(() =>
                  ctx.db.insert("tryoutAttemptPlacements", {
                    ...placementValues,
                    questionOrder: 2,
                  })
                );
                return fixture;
              }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
            )
          )
        );
        yield* Effect.promise(() =>
          expect(
            t.mutation((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                Effect.gen(function* () {
                  const attempt = yield* Effect.promise(() =>
                    ctx.db.get(seeded.attemptId)
                  );
                  if (!attempt) {
                    return yield* Effect.die(
                      "Expected one active try-out attempt."
                    );
                  }
                  return yield* finalizeLoadedAttempt({
                    attempt,
                    endReason: "submitted",
                    now: NOW + 1000,
                  });
                }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
              )
            )
          ).rejects.toMatchObject({
            code: "TRYOUT_PLACEMENT_DUPLICATE",
          })
        );
        const stored = yield* Effect.promise(() =>
          t.query((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
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
                return {
                  attempt,
                  progress,
                  scores,
                  section,
                };
              }).pipe(
                Effect.provide(
                  ConfectDatabaseReader.layer(confectSchema, ctx.db)
                )
              )
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
      Effect.runPromise(
        seedFrozenTryoutScoreState(ctx).pipe(
          Effect.provide(mutationLayer(confectSchema, ctx))
        )
      )
    );
    await expect(
      t.mutation(async (ctx) => {
        const placements = await Effect.runPromise(
          loadAttemptPlacements(attempt).pipe(
            Effect.provide(mutationLayer(confectSchema, ctx))
          )
        );
        const responseIndex = await Effect.runPromise(
          loadAttemptResponses(attempt, placements, "complete").pipe(
            Effect.provide(mutationLayer(confectSchema, ctx))
          )
        );
        const source = await Effect.runPromise(
          loadAttemptScoreSource(attempt, placements).pipe(
            Effect.provide(mutationLayer(confectSchema, ctx))
          )
        );
        if (kind === "foreign source") {
          const { _id, _creationTime, ...values } = attempt;
          const foreignId = await ctx.db.insert("tryoutAttempts", values);
          return Effect.runPromise(
            scoreTryoutSection({
              attempt,
              placements,
              responses: [],
              source: {
                ...source,
                attemptId: foreignId,
              },
              totalQuestions: 1,
            }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
          );
        }
        if (kind === "wrong strategy") {
          return Effect.runPromise(
            scoreTryoutSection({
              attempt: {
                ...attempt,
                scoringStrategy: "irt",
              },
              placements,
              responses: [],
              source,
              totalQuestions: 1,
            }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
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
        return Effect.runPromise(
          finalizeAttemptScore({
            attempt:
              kind === "inactive"
                ? {
                    ...attempt,
                    status: "completed",
                  }
                : attempt,
            endReason: "submitted",
            now: NOW,
            responseIndex,
            source,
          }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
        );
      })
    ).rejects.toMatchObject({
      code,
    });
    expect(
      await t.query((ctx) => ctx.db.query("tryoutScores").collect())
    ).toEqual([]);
    expect(await t.query((ctx) => ctx.db.get(attempt._id))).toEqual(attempt);
  });
  it("counts only complete responses and distinguishes incorrect answers", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await Effect.runPromise(
        seedFrozenTryoutScoreState(ctx).pipe(
          Effect.provide(mutationLayer(confectSchema, ctx))
        )
      );
      const response = await ctx.db.query("tryoutResponses").unique();
      assert.isNotNull(response, "Expected a scored response.");
      expect(
        summarizeResponses([
          response,
          {
            ...response,
            isComplete: false,
          },
          {
            ...response,
            isCorrect: false,
          },
        ])
      ).toEqual({
        answeredCount: 2,
        correctAnswers: 1,
      });
    });
  });
});

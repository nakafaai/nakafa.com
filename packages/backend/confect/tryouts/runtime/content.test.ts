import { DatabaseReader as ConfectDatabaseReader } from "@confect/server";
import { assert, describe, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { readTryoutSectionContentAccess } from "@repo/backend/confect/tryouts/runtime/content";
import type { TryoutSectionScore } from "@repo/backend/confect/tryouts/score";
import { api } from "@repo/backend/convex/_generated/api";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import {
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import { Array as Arr, Effect, Option } from "effect";

describe("try-out review entitlement", () => {
  it.effect(
    "keeps results free and changes answer-key access with the current plan",
    () =>
      Effect.gen(function* () {
        vi.setSystemTime(TRYOUT_TEST_NOW);
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const fixture = await seedTryoutContentAccessState(ctx, {
              attemptStatus: "completed",
              sectionStatus: "completed",
              suffix: "review-plan",
            });
            const attempt = await ctx.db.get(
              "tryoutAttempts",
              fixture.attemptId
            );
            assert.isNotNull(attempt);
            const score = {
              publishedScore: 500,
              rawScore: 0,
              scoreStatus: "official",
              scoringStrategy: "irt",
              theta: 0,
              thetaSE: 1,
            } satisfies TryoutSectionScore;
            await ctx.db.patch(
              "tryoutSectionAttempts",
              fixture.sectionAttemptId,
              {
                answeredCount: 1,
                score,
              }
            );
            await ctx.db.insert("tryoutResponses", {
              answeredAt: TRYOUT_TEST_NOW,
              isComplete: true,
              isCorrect: false,
              placementId: fixture.placementId,
              selection: { kind: "single-choice", optionKey: "option-2" },
              timeSpent: 0,
              tryoutAttemptId: fixture.attemptId,
              tryoutSectionAttemptId: fixture.sectionAttemptId,
              updatedAt: TRYOUT_TEST_NOW,
            });
            await ctx.db.insert("tryoutScores", {
              ...score,
              finalizedAt: TRYOUT_TEST_NOW,
              setIdentity: attempt.setIdentity,
              totalCorrect: 0,
              totalQuestions: 1,
              tryoutAttemptId: attempt._id,
              tryoutSnapshotId: attempt.tryoutSnapshotId,
              userId: attempt.userId,
            });
            return fixture;
          })
        );
        const owned = t.withIdentity({
          sessionId: seeded.identity.sessionId,
          subject: seeded.identity.authUserId,
        });
        const request = {
          locale: "id" as const,
          attemptId: seeded.attemptId,
          sectionKey: TRYOUT_SECTION_KEY,
        };
        const pro = yield* Effect.promise(() =>
          owned.query(
            api.tryouts.queries.runtime.getSectionAttemptState,
            request
          )
        );
        const proQuestion = Option.getOrUndefined(
          Arr.head(pro?.runtime?.questions ?? [])
        );
        assert.isDefined(proQuestion);
        assert.deepStrictEqual(proQuestion.response?.outcome, {
          status: "incorrect",
        });
        assert.strictEqual(proQuestion.responseSpec.kind, "single-choice");
        if (proQuestion.responseSpec.kind === "single-choice") {
          assert.isTrue(
            Arr.some(
              proQuestion.responseSpec.options,
              (option) => option.isCorrect === true
            )
          );
        }
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch("users", seeded.identity.userId, {
              plan: "free",
            })
          )
        );
        const free = yield* Effect.promise(() =>
          owned.query(
            api.tryouts.queries.runtime.getSectionAttemptState,
            request
          )
        );
        assert.strictEqual(free?.attempt.score?.publishedScore, 500);
        assert.strictEqual(free?.runtime?.section.score?.publishedScore, 500);
        assert.deepStrictEqual(free?.attempt.score, pro?.attempt.score);
        assert.deepStrictEqual(
          free?.runtime?.section.score,
          pro?.runtime?.section.score
        );
        const freeQuestion = Option.getOrUndefined(
          Arr.head(free?.runtime?.questions ?? [])
        );
        assert.isDefined(freeQuestion);
        assert.isDefined(freeQuestion.response);
        assert.notProperty(freeQuestion.response, "outcome");
        assert.strictEqual(freeQuestion.responseSpec.kind, "single-choice");
        if (freeQuestion.responseSpec.kind === "single-choice") {
          for (const option of freeQuestion.responseSpec.options) {
            assert.notProperty(option, "isCorrect");
          }
        }
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch("users", seeded.identity.userId, {
              plan: "pro",
            })
          )
        );
        assert.deepStrictEqual(
          yield* Effect.promise(() =>
            owned.query(
              api.tryouts.queries.runtime.getSectionAttemptState,
              request
            )
          ),
          pro
        );
      })
  );
  it.effect(
    "opens every answer to Pro and only the preview to a free learner",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            seedTryoutContentAccessState(ctx, {
              attemptStatus: "completed",
              sectionStatus: "completed",
              suffix: "review-preview",
            })
          )
        );
        const readAccess = (
          plan: "free" | "pro",
          sectionStatus: "completed" | "in-progress"
        ) =>
          Effect.promise(() =>
            t.mutation(async (ctx) => {
              await ctx.db.patch("users", seeded.identity.userId, { plan });
              const attempt = await ctx.db.get(
                "tryoutAttempts",
                seeded.attemptId
              );
              assert.isNotNull(attempt);
              return Effect.runPromiseWith(runtimeServices)(
                readTryoutSectionContentAccess(
                  sectionStatus === "in-progress"
                    ? { ...attempt, status: "in-progress" }
                    : attempt,
                  sectionStatus
                ).pipe(
                  Effect.provide(
                    ConfectDatabaseReader.layer(confectSchema, ctx.db)
                  )
                )
              );
            })
          );
        assert.deepStrictEqual(yield* readAccess("pro", "completed"), {
          answers: true,
          preview: false,
          questions: true,
        });
        assert.deepStrictEqual(yield* readAccess("free", "completed"), {
          answers: false,
          preview: true,
          questions: true,
        });
        // An unfinished section never previews answers, whatever the plan.
        assert.deepStrictEqual(yield* readAccess("free", "in-progress"), {
          answers: false,
          preview: false,
          questions: true,
        });
      })
  );
  it.effect(
    "does not release review content after its account has been removed",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            seedTryoutContentAccessState(ctx, {
              attemptStatus: "completed",
              sectionStatus: "completed",
              suffix: "review-deleted-owner",
            })
          )
        );
        const attempt = yield* Effect.promise(() =>
          t.query((ctx) => ctx.db.get("tryoutAttempts", seeded.attemptId))
        );
        assert.isNotNull(attempt);
        yield* Effect.promise(() =>
          t.mutation((ctx) => ctx.db.delete("users", seeded.identity.userId))
        );
        const access = yield* Effect.promise(() =>
          t.query((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              readTryoutSectionContentAccess(attempt, "completed").pipe(
                Effect.provide(
                  ConfectDatabaseReader.layer(confectSchema, ctx.db)
                )
              )
            )
          )
        );
        assert.deepStrictEqual(access, {
          answers: false,
          preview: false,
          questions: false,
        });
      })
  );
});

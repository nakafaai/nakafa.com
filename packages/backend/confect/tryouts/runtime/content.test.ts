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
import { Effect } from "effect";

describe("try-out review entitlement", () => {
  it.effect(
    "keeps results free and changes answer-key access with the current plan",
    () =>
      Effect.gen(function* () {
        vi.setSystemTime(new Date(TRYOUT_TEST_NOW));
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
                score,
              }
            );
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
        const proQuestion = pro?.runtime?.questions.at(0);
        assert.isDefined(proQuestion);
        assert.strictEqual(proQuestion.responseSpec.kind, "single-choice");
        if (proQuestion.responseSpec.kind === "single-choice") {
          assert.isTrue(
            proQuestion.responseSpec.options.some((option) => option.isCorrect)
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
        const freeQuestion = free?.runtime?.questions.at(0);
        assert.isDefined(freeQuestion);
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
          questions: false,
        });
      })
  );
});

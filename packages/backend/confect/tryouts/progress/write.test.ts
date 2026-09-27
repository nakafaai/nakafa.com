import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { writeTryoutSetProgress } from "@repo/backend/confect/tryouts/progress/write";
import { insertTryoutAttempt } from "@repo/backend/test/tryout/runtime";
import { makeTryoutSet, TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { ConvexError } from "convex/values";
import { Effect } from "effect";

type ProgressInput = Parameters<typeof writeTryoutSetProgress>[0];
type ProgressScoreMismatch = Pick<
  ProgressInput,
  "publishedScore" | "status"
> & {
  readonly code: string;
  readonly message: string;
};

/** Verifies that one invalid progress score pair fails through the typed seam. */
const expectProgressScoreMismatch = Effect.fn(
  "tryouts.progress.test.expectProgressScoreMismatch"
)(function* (scenario: ProgressScoreMismatch) {
  const runtimeServices = yield* Effect.context<never>();
  const t = createConvexTestWithBetterAuth();
  yield* Effect.promise(() =>
    expect(
      t.mutation((ctx) =>
        Effect.runPromiseWith(runtimeServices)(
          Effect.gen(function* () {
            const user = yield* Effect.promise(() =>
              seedAuthenticatedUser(ctx, {
                now: TRYOUT_TEST_NOW,
                suffix: `tryout-progress-score-${scenario.status}`,
              })
            );
            const set = makeTryoutSet();
            const attemptId = yield* Effect.promise(() =>
              insertTryoutAttempt(ctx, {
                scoringStrategy: "raw",
                sectionSnapshots: [],
                set,
                status: scenario.status,
                userId: user.userId,
              })
            );
            const attempt = yield* Effect.promise(() => ctx.db.get(attemptId));
            if (!attempt) {
              return yield* Effect.die("Expected progress score fixtures.");
            }
            yield* writeTryoutSetProgress({
              attempt,
              publishedScore: scenario.publishedScore,
              status: scenario.status,
              updatedAt: TRYOUT_TEST_NOW,
            });
          }).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).rejects.toMatchObject({
      code: scenario.code,
      message: scenario.message,
    })
  );
});
describe("tryouts/progress", () => {
  it.effect("keeps only the latest attempt and maps every workflow rank", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = createConvexTestWithBetterAuth();
      const progress = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            Effect.gen(function* () {
              const user = yield* Effect.promise(() =>
                seedAuthenticatedUser(ctx, {
                  now: TRYOUT_TEST_NOW,
                  suffix: "tryout-progress",
                })
              );
              const set = makeTryoutSet();
              const firstAttemptId = yield* Effect.promise(() =>
                insertTryoutAttempt(ctx, {
                  scoringStrategy: "raw",
                  sectionSnapshots: [],
                  set,
                  userId: user.userId,
                })
              );
              const firstAttempt = yield* Effect.promise(() =>
                ctx.db.get(firstAttemptId)
              );
              if (!firstAttempt) {
                return yield* Effect.die("Expected first attempt fixture.");
              }
              yield* writeTryoutSetProgress({
                attempt: firstAttempt,
                publishedScore: null,
                status: "in-progress",
                updatedAt: TRYOUT_TEST_NOW,
              });
              yield* writeTryoutSetProgress({
                attempt: firstAttempt,
                publishedScore: 75,
                status: "completed",
                updatedAt: TRYOUT_TEST_NOW + 1,
              });
              const latestAttemptId = yield* Effect.promise(() =>
                insertTryoutAttempt(ctx, {
                  scoringStrategy: "raw",
                  sectionSnapshots: [],
                  set,
                  status: "expired",
                  userId: user.userId,
                })
              );
              yield* Effect.promise(() =>
                ctx.db.patch(latestAttemptId, {
                  attemptNumber: 2,
                })
              );
              const latestAttempt = yield* Effect.promise(() =>
                ctx.db.get(latestAttemptId)
              );
              if (!latestAttempt) {
                return yield* Effect.die("Expected latest attempt fixture.");
              }
              yield* writeTryoutSetProgress({
                attempt: latestAttempt,
                publishedScore: 50,
                status: "expired",
                updatedAt: TRYOUT_TEST_NOW + 2,
              });
              yield* writeTryoutSetProgress({
                attempt: firstAttempt,
                publishedScore: null,
                status: "in-progress",
                updatedAt: TRYOUT_TEST_NOW + 3,
              });
              return yield* Effect.promise(() =>
                ctx.db
                  .query("tryoutSetProgress")
                  .withIndex("by_userId_and_set", (query) =>
                    query
                      .eq("userId", user.userId)
                      .eq("countryKey", set.countryKey)
                      .eq("examKey", set.examKey)
                      .eq("trackKey", set.trackKey)
                      .eq("setKey", set.setKey)
                  )
                  .unique()
              );
            }).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      expect(progress).toMatchObject({
        attemptNumber: 2,
        publishedScore: 50,
        status: "expired",
        statusRank: 3,
      });
    })
  );
  it.effect("rejects active progress that exposes a score", () =>
    expectProgressScoreMismatch({
      code: "TRYOUT_ACTIVE_PROGRESS_HAS_SCORE",
      message: "Active try-out progress cannot expose a score.",
      publishedScore: 80,
      status: "in-progress",
    })
  );
  it.effect("rejects terminal progress without a score", () =>
    expectProgressScoreMismatch({
      code: "TRYOUT_TERMINAL_PROGRESS_SCORE_REQUIRED",
      message: "Terminal try-out progress requires a score.",
      publishedScore: null,
      status: "completed",
    })
  );
  it.each([
    {
      cause: new ConvexError({
        code: "PROGRESS_STORAGE_LIMIT",
        message: "Storage limit reached.",
      }),
      code: "TRYOUT_PROGRESS_WRITE_FAILED",
    },
    {
      cause: new Error("Storage unavailable."),
      code: "TRYOUT_PROGRESS_WRITE_FAILED",
    },
  ])(
    "preserves the typed failure contract for $code without partial progress",
    async ({ cause, code }) => {
      const t = createConvexTestWithBetterAuth();
      await expect(
        t.mutation(async (ctx) => {
          const user = await seedAuthenticatedUser(ctx, {
            now: TRYOUT_TEST_NOW,
            suffix: code,
          });
          const id = await insertTryoutAttempt(ctx, {
            scoringStrategy: "raw",
            sectionSnapshots: [],
            set: makeTryoutSet(),
            userId: user.userId,
          });
          const attempt = await ctx.db.get(id);
          if (!attempt) {
            throw new Error("Expected an attempt.");
          }
          vi.spyOn(ctx.db, "insert").mockRejectedValueOnce(cause);
          return Effect.runPromise(
            writeTryoutSetProgress({
              attempt,
              publishedScore: null,
              status: "in-progress",
              updatedAt: TRYOUT_TEST_NOW,
            }).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          );
        })
      ).rejects.toMatchObject({
        code,
        message: "Unable to update try-out progress.",
      });
      expect(
        await t.query((ctx) => ctx.db.query("tryoutSetProgress").collect())
      ).toEqual([]);
      expect(
        await t.query((ctx) => ctx.db.query("tryoutAttempts").collect())
      ).toEqual([]);
    }
  );
});

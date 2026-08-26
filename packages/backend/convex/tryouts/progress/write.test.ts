import { describe, expect, it } from "@effect/vitest";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { writeTryoutSetProgress } from "@repo/backend/convex/tryouts/progress/write";
import { insertTryoutAttempt } from "@repo/backend/test/tryout-runtime";
import { makeTryoutSet, TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { Effect } from "effect";

const SIGNED_SET_IDENTITY = tryoutCatalogNodeIdentity({
  appLocale: AppLocaleSchema.make("id"),
  countryKey: "indonesia",
  examKey: "snbt",
  kind: "set",
  setKey: "set-1",
  trackKey: "2027",
});
type ProgressInput = Parameters<typeof writeTryoutSetProgress>[1];
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
  const t = createConvexTestWithBetterAuth();

  yield* Effect.promise(() =>
    expect(
      t.mutation((ctx) =>
        runConvexProgram(
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

            yield* writeTryoutSetProgress(ctx, {
              attempt,
              publishedScore: scenario.publishedScore,
              status: scenario.status,
              updatedAt: TRYOUT_TEST_NOW,
            });
          })
        )
      )
    ).rejects.toMatchObject({
      data: {
        code: scenario.code,
        message: scenario.message,
      },
    })
  );
});

describe("tryouts/progress", () => {
  it.effect("keeps only the latest attempt and maps every workflow rank", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();

      const progress = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
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

              yield* writeTryoutSetProgress(ctx, {
                attempt: firstAttempt,
                publishedScore: null,
                status: "in-progress",
                updatedAt: TRYOUT_TEST_NOW,
              });
              yield* writeTryoutSetProgress(ctx, {
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
                ctx.db.patch(latestAttemptId, { attemptNumber: 2 })
              );
              const latestAttempt = yield* Effect.promise(() =>
                ctx.db.get(latestAttemptId)
              );

              if (!latestAttempt) {
                return yield* Effect.die("Expected latest attempt fixture.");
              }

              yield* writeTryoutSetProgress(ctx, {
                attempt: latestAttempt,
                publishedScore: 50,
                status: "expired",
                updatedAt: TRYOUT_TEST_NOW + 2,
              });
              yield* writeTryoutSetProgress(ctx, {
                attempt: firstAttempt,
                publishedScore: null,
                status: "in-progress",
                updatedAt: TRYOUT_TEST_NOW + 3,
              });

              return yield* Effect.promise(() =>
                ctx.db
                  .query("tryoutSetProgress")
                  .withIndex("by_userId_and_setIdentity", (query) =>
                    query
                      .eq("userId", user.userId)
                      .eq("setIdentity", SIGNED_SET_IDENTITY)
                  )
                  .unique()
              );
            })
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
});

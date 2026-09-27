import { RegisteredConvexFunction } from "@confect/server";
import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { TryoutScoreReadError } from "@repo/backend/confect/tryouts/score";
import { loadAttemptScoreResult } from "@repo/backend/confect/tryouts/score/result";
import { api } from "@repo/backend/convex/_generated/api";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import { ensureTestTryoutRuntimeBundle } from "@repo/backend/test/runtime/bundle";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import {
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 7, 8, 12, 0, 0);
afterEach(() => vi.useRealTimers());
describe("tryouts/score/result", () => {
  it.each(["theta", "thetaSE"] as const)(
    "rejects a stored attempt estimate with only %s through the public state query",
    async (field) => {
      vi.useFakeTimers({
        toFake: ["Date", "setTimeout", "clearTimeout"],
      });
      vi.setSystemTime(TRYOUT_TEST_NOW);
      const t = createConvexTestWithBetterAuth();
      const fixture = await t.mutation(async (ctx) => {
        const seeded = await seedTryoutContentAccessState(ctx, {
          attemptStatus: "completed",
          sectionStatus: "completed",
          suffix: `incomplete-estimate-${field}`,
        });
        const attempt = await ctx.db.get(seeded.attemptId);
        assert(attempt);
        await ctx.db.insert("tryoutScores", {
          finalizedAt: TRYOUT_TEST_NOW,
          publishedScore: 500,
          rawScore: 0,
          scoreStatus: "provisional",
          scoringStrategy: "irt",
          setIdentity: attempt.setIdentity,
          totalCorrect: 0,
          totalQuestions: attempt.totalQuestions,
          tryoutAttemptId: attempt._id,
          tryoutSnapshotId: attempt.tryoutSnapshotId,
          userId: attempt.userId,
          [field]: 0.5,
        });
        return seeded;
      });
      const owner = t.withIdentity({
        subject: fixture.identity.authUserId,
        sessionId: fixture.identity.sessionId,
      });
      await expect(
        owner.query(api.tryouts.queries.runtime.getSetAttemptState, {
          locale: "id",
          attemptId: fixture.attemptId,
        })
      ).rejects.toMatchObject({
        data: {
          code: "TRYOUT_SCORE_ESTIMATE_INCOMPLETE",
        },
      });
    }
  );
  it("rejects a completed section with no score through the public section query", async () => {
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout"],
    });
    vi.setSystemTime(TRYOUT_TEST_NOW);
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "completed",
        suffix: "missing-section-score",
      })
    );
    const owner = t.withIdentity({
      subject: fixture.identity.authUserId,
      sessionId: fixture.identity.sessionId,
    });
    await expect(
      owner.query(api.tryouts.queries.runtime.getSectionAttemptState, {
        locale: "id",
        attemptId: fixture.attemptId,
        sectionKey: TRYOUT_SECTION_KEY,
      })
    ).rejects.toMatchObject({
      data: {
        code: "TRYOUT_SECTION_SCORE_NOT_FOUND",
      },
    });
  });
  it.effect(
    "returns a typed integrity failure for a terminal attempt without a score",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = createConvexTestWithBetterAuth();
        const identity = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            seedAuthenticatedUser(ctx, {
              now: NOW,
              suffix: "missing-tryout-score",
            })
          )
        );
        const failure = yield* Effect.promise(() =>
          t.run((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              Effect.gen(function* () {
                const tryoutSnapshotId = `sha256:${"a".repeat(64)}`;
                const runtime = yield* Effect.promise(() =>
                  ensureTestTryoutRuntimeBundle(ctx, tryoutSnapshotId)
                );
                const attemptId = yield* Effect.promise(() =>
                  ctx.db.insert("tryoutAttempts", {
                    accessEndsAt: NOW + 3_600_000,
                    accessSourceKind: "free",
                    attemptNumber: 1,
                    completedAt: NOW,
                    completedSectionKeys: [],
                    countsForCompetition: false,
                    countryKey: "indonesia",
                    endReason: "submitted",
                    examKey: "snbt",
                    expiresAt: NOW + 3_600_000,
                    lastActivityAt: NOW,
                    appLocale: "id",
                    scoreStatus: "official",
                    scoringStrategy: "raw",
                    sectionSnapshots: [],
                    setIdentity: "set:indonesia:snbt:2027:set-1",
                    setKey: "set-1",
                    setPublicPath: "try-out/indonesia/snbt/2027/set-1",
                    snapshotReleaseId: TEST_RELEASE_ID,
                    startedAt: NOW - 1000,
                    status: "completed",
                    totalCorrect: 0,
                    totalQuestions: 0,
                    trackKey: "2027",
                    tryoutBundleHash: runtime.bundleHash,
                    tryoutBundleId: runtime.bundleId,
                    tryoutSnapshotId,
                    userId: identity.userId,
                  })
                );
                const attempt = yield* Effect.promise(() =>
                  ctx.db.get(attemptId)
                );
                if (!attempt) {
                  return yield* Effect.die(
                    "Expected the terminal attempt fixture."
                  );
                }
                return yield* loadAttemptScoreResult(attempt).pipe(
                  Effect.match({
                    onFailure: (error) => ({
                      _tag: error._tag,
                      code: error.code,
                      message: error.message,
                    }),
                    onSuccess: () => null,
                  })
                );
              }).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        const expected = new TryoutScoreReadError({
          code: "TRYOUT_SCORE_NOT_FOUND",
          message: "Terminal try-out attempt is missing its score snapshot.",
        });
        expect(failure).toEqual({
          _tag: expected._tag,
          code: expected.code,
          message: expected.message,
        });
      })
  );
});

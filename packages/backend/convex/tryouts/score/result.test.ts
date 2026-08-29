import { describe, expect, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  loadAttemptScoreResult,
  TryoutScoreReadError,
} from "@repo/backend/convex/tryouts/score/result";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import { ensureTestTryoutRuntimeBundle } from "@repo/backend/test/runtime/bundle";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 7, 8, 12, 0, 0);

describe("tryouts/score/result", () => {
  it.effect(
    "returns a typed integrity failure for a terminal attempt without a score",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const identity = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              Effect.promise(() =>
                seedAuthenticatedUser(ctx, {
                  now: NOW,
                  suffix: "missing-tryout-score",
                })
              )
            )
          )
        );

        const failure = yield* Effect.promise(() =>
          t.run((ctx) =>
            runConvexProgram(
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
                return yield* loadAttemptScoreResult(ctx, attempt).pipe(
                  Effect.match({
                    onFailure: (error) => ({
                      _tag: error._tag,
                      code: error.code,
                      message: error.message,
                    }),
                    onSuccess: () => null,
                  })
                );
              })
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

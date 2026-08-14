import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  loadAttemptScoreResult,
  TryoutScoreReadError,
} from "@repo/backend/convex/tryouts/score/result";
import { TEST_RELEASE_ID } from "@repo/backend/test/content-release";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 7, 8, 12, 0, 0);

describe("tryouts/score/result", () => {
  it("returns a typed integrity failure for a terminal attempt without a score", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "missing-tryout-score",
      })
    );

    const failure = await t.run(async (ctx) => {
      const attemptId = await ctx.db.insert("tryoutAttempts", {
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
        tryoutSnapshotId: `sha256:${"a".repeat(64)}`,
        userId: identity.userId,
      });
      const attempt = await ctx.db.get(attemptId);
      if (!attempt) {
        throw new Error("Expected the terminal attempt fixture.");
      }
      const error = await Effect.runPromise(
        loadAttemptScoreResult(ctx, attempt).pipe(Effect.flip)
      );
      return {
        _tag: error._tag,
        code: error.code,
        message: error.message,
      };
    });

    const expected = new TryoutScoreReadError({
      code: "TRYOUT_SCORE_NOT_FOUND",
      message: "Terminal try-out attempt is missing its score snapshot.",
    });
    expect(failure).toEqual({
      _tag: expected._tag,
      code: expected.code,
      message: expected.message,
    });
  });
});

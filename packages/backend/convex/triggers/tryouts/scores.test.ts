import posthogTest from "@posthog/convex/test";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { tryoutScoresHandler } from "@repo/backend/convex/triggers/tryouts/scores";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 7, 12, 0, 0);

/** Builds a trigger test instance with its analytics component boundary. */
function createTryoutScoreTriggerTest() {
  const t = convexTest(schema, convexModules);
  posthogTest.register(t);
  return t;
}

/** Inserts the immutable attempt graph observed by the score trigger. */
async function insertScoreGraph(ctx: MutationCtx) {
  const userId = await ctx.db.insert("users", {
    authId: "auth-tryout-score-trigger",
    credits: 0,
    creditsResetAt: NOW,
    email: "tryout-score-trigger@example.com",
    name: "Try-out Score Trigger",
    plan: "free",
  });
  const setIdentity = "tryout:set:indonesia:snbt:2027:id:set-1";
  const tryoutSnapshotId = `sha256:${"1".repeat(64)}`;
  const attemptId = await ctx.db.insert("tryoutAttempts", {
    accessEndsAt: NOW + 86_400_000,
    accessSourceKind: "free",
    attemptNumber: 2,
    completedAt: NOW,
    completedSectionKeys: [],
    countsForCompetition: false,
    endReason: "submitted",
    expiresAt: NOW + 86_400_000,
    lastActivityAt: NOW,
    scoreStatus: "official",
    scoringStrategy: "raw",
    sectionSnapshots: [],
    startedAt: NOW - 60_000,
    status: "completed",
    totalCorrect: 8,
    totalQuestions: 10,
    userId,
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    setIdentity,
    setKey: "set-1",
    setPublicPath: "try-out/indonesia/snbt/2027/set-1",
    snapshotReleaseId: "release-test-score-trigger",
    trackKey: "2027",
    tryoutSnapshotId,
  });
  const scoreId = await ctx.db.insert("tryoutScores", {
    finalizedAt: NOW,
    publishedScore: 80,
    rawScore: 80,
    scoreStatus: "official",
    scoringStrategy: "raw",
    totalCorrect: 8,
    totalQuestions: 10,
    tryoutAttemptId: attemptId,
    tryoutSnapshotId,
    setIdentity,
    userId,
  });
  const score = await ctx.db.get("tryoutScores", scoreId);

  if (!score) {
    throw new Error("Expected the inserted try-out score.");
  }

  return { score, userId };
}

describe("triggers/tryouts/scores", () => {
  it("queues one deletion-aware event when a score is first inserted", async () => {
    const t = createTryoutScoreTriggerTest();

    const identity = await t.mutation(async (ctx) => {
      const { score, userId } = await insertScoreGraph(ctx);

      await tryoutScoresHandler(ctx, {
        id: score._id,
        newDoc: score,
        oldDoc: null,
        operation: "insert",
      });

      return { userId };
    });
    const scheduledJobs = await t.query(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(scheduledJobs).toEqual([
      expect.objectContaining({
        args: [
          expect.objectContaining({
            distinctId: identity.userId,
            event: "tryout attempt completed",
            properties: JSON.stringify({
              attempt_number: 2,
              country_key: "indonesia",
              exam_key: "snbt",
              locale: "id",
              raw_score_percentage: 80,
              score_status: "official",
              set_key: "set-1",
              total_correct: 8,
              total_questions: 10,
              track_key: "2027",
            }),
            timestamp: NOW,
          }),
        ],
      }),
    ]);
  });

  it("does not emit duplicate events for score updates or deletion", async () => {
    const t = createTryoutScoreTriggerTest();

    await t.mutation(async (ctx) => {
      const { score } = await insertScoreGraph(ctx);

      await tryoutScoresHandler(ctx, {
        id: score._id,
        newDoc: score,
        oldDoc: score,
        operation: "update",
      });
      await tryoutScoresHandler(ctx, {
        id: score._id,
        newDoc: null,
        oldDoc: score,
        operation: "delete",
      });
    });

    const scheduledJobs = await t.query(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(scheduledJobs).toHaveLength(0);
  });
});

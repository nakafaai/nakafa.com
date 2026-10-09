import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import posthogTest from "@posthog/convex/test";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { triggers } from "@repo/backend/confect/functions";
import { seedAnalyticsConsent } from "@repo/backend/confect/test.helpers";
import { convexModules } from "@repo/backend/confect/test.setup";
import { tryoutScoresHandler } from "@repo/backend/confect/triggers/tryouts/scores";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { ensureTestTryoutRuntimeBundle } from "@repo/backend/test/runtime/bundle";
import { encodeJsonText } from "@repo/utilities/json";
import { convexTest } from "convex-test";
import { Effect, Struct } from "effect";

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
  const runtime = await ensureTestTryoutRuntimeBundle(
    ctx,
    tryoutSnapshotId,
    "release-test-score-trigger"
  );
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
    appLocale: "id",
    setIdentity,
    setKey: "set-1",
    setPublicPath: "try-out/indonesia/snbt/2027/set-1",
    snapshotReleaseId: "release-test-score-trigger",
    trackKey: "2027",
    tryoutBundleHash: runtime.bundleHash,
    tryoutBundleId: runtime.bundleId,
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
  return {
    score,
    userId,
  };
}
describe("triggers/tryouts/scores", () => {
  it("rolls back score insertion when its attempt is missing", async () => {
    const t = createTryoutScoreTriggerTest();
    const score = await t.mutation(async (ctx) => {
      const graph = await insertScoreGraph(ctx);
      await ctx.db.delete("tryoutScores", graph.score._id);
      await ctx.db.delete("tryoutAttempts", graph.score.tryoutAttemptId);
      return graph.score;
    });
    await expect(
      t.mutation((ctx) =>
        triggers
          .wrapDB(ctx)
          .db.insert(
            "tryoutScores",
            Struct.omit(score, ["_id", "_creationTime"])
          )
      )
    ).rejects.toMatchObject({
      code: "TRYOUT_SCORE_ANALYTICS_FAILED",
    });
    await expect(
      t.query((ctx) => ctx.db.query("tryoutScores").collect())
    ).resolves.toEqual([]);
    await expect(
      t.query((ctx) => ctx.db.system.query("_scheduled_functions").collect())
    ).resolves.toEqual([]);
  });
  it("queues one deletion-aware event when a score is first inserted", async () => {
    const t = createTryoutScoreTriggerTest();
    const identity = await t.mutation(async (ctx) => {
      const { score, userId } = await insertScoreGraph(ctx);
      await seedAnalyticsConsent(ctx, {
        decidedAt: NOW,
        userId,
      });
      await Effect.runPromise(
        tryoutScoresHandler({
          id: score._id,
          newDoc: score,
          oldDoc: null,
          operation: "insert",
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
      return {
        userId,
      };
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
            properties: encodeJsonText({
              attempt_number: 2,
              country_key: "indonesia",
              exam_key: "snbt",
              locale: "id",
              score_status: "official",
              set_key: "set-1",
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
      await Effect.runPromise(
        tryoutScoresHandler({
          id: score._id,
          newDoc: score,
          oldDoc: score,
          operation: "update",
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
      await Effect.runPromise(
        tryoutScoresHandler({
          id: score._id,
          newDoc: null,
          oldDoc: score,
          operation: "delete",
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
    });
    const scheduledJobs = await t.query(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(scheduledJobs).toHaveLength(0);
  });
});

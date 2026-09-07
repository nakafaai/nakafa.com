import { assert, describe, expect, it } from "@effect/vitest";
import { cleanupUserTryouts } from "@repo/backend/convex/auth/cleanup/tryouts";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { writeTryoutSetProgress } from "@repo/backend/convex/tryouts/progress/write";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { Effect } from "effect";

describe("auth/cleanup/tryouts", () => {
  it.effect("deletes the last attempt and its attempt-only scale", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const runtime = await seedTryoutContentAccessState(ctx, {
            attemptStatus: "completed",
            sectionStatus: "completed",
            suffix: "cleanup-history-scale",
          });
          const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
            history: true,
            model: "2pl",
            publishedAt: 1,
            questionCount: 1,
            setIdentity: "set:cleanup-history-scale",
            status: "official",
            tryoutSnapshotId: "snapshot:cleanup-history-scale",
          });
          const runId = await ctx.db.insert("irtCalibrationRuns", {
            attemptCount: 1,
            iterationCount: 1,
            maxParameterDelta: 0,
            model: "2pl",
            questionCount: 1,
            responseCount: 1,
            scaleVersionId,
            sectionIdentity: "section:cleanup-history-scale",
            startedAt: 1,
            status: "completed",
            updatedAt: 1,
          });
          await ctx.db.insert("irtScaleItems", {
            calibrationRunId: runId,
            calibrationStatus: "calibrated",
            correctRate: 1,
            difficulty: 0,
            discrimination: 1,
            placementIdentity: "placement:cleanup-history-scale",
            placementRowHash: `sha256:${"a".repeat(64)}`,
            responseCount: 1,
            scaleVersionId,
          });
          await ctx.db.patch("tryoutAttempts", runtime.attemptId, {
            scaleVersionId,
          });
          const attempt = await ctx.db.get("tryoutAttempts", runtime.attemptId);
          assert.ok(attempt);
          await runConvexProgram(
            writeTryoutSetProgress(ctx, {
              attempt,
              publishedScore: 100,
              status: "completed",
              updatedAt: attempt.lastActivityAt,
            })
          );
          await ctx.db.insert("tryoutResponses", {
            answeredAt: 1,
            isComplete: true,
            isCorrect: true,
            placementId: runtime.placementId,
            selection: { kind: "single-choice", optionKey: "option-1" },
            timeSpent: 1,
            tryoutAttemptId: attempt._id,
            tryoutSectionAttemptId: runtime.sectionAttemptId,
            updatedAt: 1,
          });
          await ctx.db.insert("tryoutScores", {
            finalizedAt: 1,
            publishedScore: 100,
            rawScore: 1,
            scaleVersionId,
            scoreStatus: "official",
            scoringStrategy: "irt",
            setIdentity: attempt.setIdentity,
            totalCorrect: 1,
            totalQuestions: 1,
            tryoutAttemptId: attempt._id,
            tryoutSnapshotId: attempt.tryoutSnapshotId,
            userId: attempt.userId,
          });
          return {
            attemptId: runtime.attemptId,
            scaleVersionId,
            userId: runtime.identity.userId,
          };
        })
      );

      let progressed = true;
      for (let page = 0; page < 16 && progressed; page += 1) {
        progressed = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(cleanupUserTryouts(ctx, seeded.userId))
          )
        );
      }
      expect(progressed).toBe(false);
      const state = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          attempt: await ctx.db.get(seeded.attemptId),
          items: await ctx.db.query("irtScaleItems").collect(),
          runs: await ctx.db.query("irtCalibrationRuns").collect(),
          scale: await ctx.db.get(seeded.scaleVersionId),
        }))
      );
      expect(state).toEqual({
        attempt: null,
        items: [],
        runs: [],
        scale: null,
      });
    })
  );

  it("removes a deleted user's entitlement and grant without deleting shared campaign access", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(async (ctx) => {
      const runtime = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "cleanup-access",
      });
      const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        campaignKind: "access-pass",
        enabled: true,
        endsAt: 100,
        firstRedeemedAt: 1,
        name: "Technical cleanup access",
        redeemStatus: "active",
        resultsFinalizedAt: null,
        resultsStatus: "pending",
        slug: "test-cleanup-access",
        startsAt: 1,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "test-cleanup-link",
        enabled: true,
        label: "Technical cleanup link",
      });
      const grantId = await ctx.db.insert("tryoutAccessGrants", {
        campaignId,
        linkId,
        userId: runtime.identity.userId,
        endsAt: 100,
        redeemedAt: 1,
        status: "active",
      });
      await ctx.db.insert("tryoutEntitlements", {
        accessCampaignId: campaignId,
        accessGrantId: grantId,
        countryKey: "indonesia",
        examKey: "snbt",
        endsAt: 100,
        sourceKind: "access-pass",
        startsAt: 1,
        userId: runtime.identity.userId,
      });
      return { campaignId, linkId, userId: runtime.identity.userId };
    });
    let progressed = true;
    for (let page = 0; page < 16 && progressed; page += 1) {
      progressed = await t.mutation((ctx) =>
        runConvexProgram(cleanupUserTryouts(ctx, fixture.userId))
      );
    }
    expect(progressed).toBe(false);
    const remaining = await t.query(async (ctx) => ({
      campaign: await ctx.db.get("tryoutAccessCampaigns", fixture.campaignId),
      link: await ctx.db.get("tryoutAccessLinks", fixture.linkId),
      entitlements: await ctx.db.query("tryoutEntitlements").collect(),
      grants: await ctx.db.query("tryoutAccessGrants").collect(),
    }));
    expect(remaining.entitlements).toEqual([]);
    expect(remaining.grants).toEqual([]);
    expect(remaining.campaign?._id).toBe(fixture.campaignId);
    expect(remaining.link?._id).toBe(fixture.linkId);
  });
});

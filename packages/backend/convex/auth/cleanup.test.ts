import { internal } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import { insertTryoutAccessCampaign } from "@repo/backend/convex/tryoutAccess/test.helpers";
import {
  createTryoutTestConvex,
  insertCompletedTryoutAttempt,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("auth/cleanup", () => {
  it("deletes tryout runtime and access rows with the app user", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "auth-cleanup-runtime",
      });
      const slug = "auth-cleanup-runtime";
      const { scaleVersionId, setId, tryoutId } = await insertTryoutSkeleton(
        ctx,
        slug
      );
      const { setAttemptId, tryoutAttemptId } =
        await insertCompletedTryoutAttempt(ctx, {
          scaleVersionId,
          setId,
          slug,
          tryoutId,
          userId: identity.userId,
        });
      const campaignId = await insertTryoutAccessCampaign(ctx, {
        slug,
        name: "Cleanup Runtime Campaign",
        targetProducts: ["snbt"],
        campaignKind: "access-pass",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: NOW - 60 * 1000,
        endsAt: NOW + 24 * 60 * 60 * 1000,
        grantDurationDays: 30,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: slug,
        label: "Cleanup Runtime Campaign",
        enabled: true,
      });
      const grantId = await ctx.db.insert("tryoutAccessGrants", {
        campaignId,
        linkId,
        userId: identity.userId,
        redeemedAt: NOW,
        endsAt: NOW + 24 * 60 * 60 * 1000,
        status: "active",
      });

      await ctx.db.insert("userTryoutEntitlements", {
        userId: identity.userId,
        product: "snbt",
        sourceKind: "access-pass",
        accessCampaignId: campaignId,
        accessGrantId: grantId,
        startsAt: NOW,
        endsAt: NOW + 24 * 60 * 60 * 1000,
      });
      await ctx.db.insert("exerciseAnswers", {
        attemptId: setAttemptId,
        exerciseNumber: 1,
        selectedOptionId: "choice-a",
        isCorrect: true,
        timeSpent: 30,
        answeredAt: NOW,
        updatedAt: NOW,
      });

      return {
        grantId,
        setAttemptId,
        tryoutAttemptId,
        userId: identity.userId,
      };
    });

    await t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
      userId: state.userId,
    });

    const result = await t.query(async (ctx) => {
      return {
        answers: await ctx.db
          .query("exerciseAnswers")
          .withIndex("by_attemptId_and_exerciseNumber", (q) =>
            q.eq("attemptId", state.setAttemptId)
          )
          .collect(),
        entitlements: await ctx.db
          .query("userTryoutEntitlements")
          .withIndex("by_userId_and_product_and_sourceKind_and_endsAt", (q) =>
            q.eq("userId", state.userId)
          )
          .collect(),
        exerciseAttempt: await ctx.db.get(
          "exerciseAttempts",
          state.setAttemptId
        ),
        grant: await ctx.db.get("tryoutAccessGrants", state.grantId),
        tryoutAttempt: await ctx.db.get(
          "tryoutAttempts",
          state.tryoutAttemptId
        ),
        tryoutPartAttempts: await ctx.db
          .query("tryoutPartAttempts")
          .withIndex("by_tryoutAttemptId_and_partIndex", (q) =>
            q.eq("tryoutAttemptId", state.tryoutAttemptId)
          )
          .collect(),
        user: await ctx.db.get("users", state.userId),
      };
    });

    expect(result.user).toBeNull();
    expect(result.tryoutAttempt).toBeNull();
    expect(result.tryoutPartAttempts).toHaveLength(0);
    expect(result.exerciseAttempt).toBeNull();
    expect(result.answers).toHaveLength(0);
    expect(result.entitlements).toHaveLength(0);
    expect(result.grant).toBeNull();
  });
});

import { internal } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  createTryoutTestConvex,
  insertCompletedTryoutAttempt,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it, vi } from "vitest";

describe("auth/cleanup", () => {
  it("deletes the user tryout control row with the app user", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      return await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "auth-cleanup-control",
      });
    });

    await t.mutation(async (ctx) => {
      await ctx.db.insert("userTryoutControls", {
        updatedAt: NOW + 1,
        userId: identity.userId,
      });
    });

    await t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
      userId: identity.userId,
    });

    const result = await t.query(async (ctx) => {
      return {
        controls: await ctx.db
          .query("userTryoutControls")
          .withIndex("by_userId", (q) => q.eq("userId", identity.userId))
          .collect(),
        user: await ctx.db.get("users", identity.userId),
      };
    });

    expect(result.user).toBeNull();
    expect(result.controls).toHaveLength(0);
  });

  it("deletes duplicate control rows across scheduled cleanup retries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      return await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "auth-cleanup-duplicate-controls",
      });
    });

    await t.mutation(async (ctx) => {
      for (let index = 0; index < 26; index += 1) {
        await ctx.db.insert("userTryoutControls", {
          updatedAt: NOW + index + 1,
          userId: identity.userId,
        });
      }
    });

    await t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
      userId: identity.userId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const result = await t.query(async (ctx) => {
      return {
        controls: await ctx.db
          .query("userTryoutControls")
          .withIndex("by_userId", (q) => q.eq("userId", identity.userId))
          .collect(),
        user: await ctx.db.get("users", identity.userId),
      };
    });

    expect(result.controls).toHaveLength(0);
    expect(result.user).toBeNull();

    vi.useRealTimers();
  });

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
      const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug,
        name: "Cleanup Runtime Campaign",
        products: ["snbt"],
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
        control: await ctx.db
          .query("userTryoutControls")
          .withIndex("by_userId", (q) => q.eq("userId", state.userId))
          .unique(),
        entitlements: await ctx.db
          .query("userTryoutEntitlements")
          .withIndex("by_userId_and_sourceKind_and_subscriptionId", (q) =>
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
    expect(result.control).toBeNull();
    expect(result.tryoutAttempt).toBeNull();
    expect(result.tryoutPartAttempts).toHaveLength(0);
    expect(result.exerciseAttempt).toBeNull();
    expect(result.answers).toHaveLength(0);
    expect(result.entitlements).toHaveLength(0);
    expect(result.grant).toBeNull();
  });
});

import { internal } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  createTryoutTestConvex,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryoutAccess/mutations/internal/competition", () => {
  it("finalizes ended competition campaigns and expires lingering active attempts", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "competition-finalize",
      });
      const tryout = await insertTryoutSkeleton(ctx, "competition-finalize");
      const campaignEndsAt = NOW - 1;
      const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "competition-finalize",
        name: "Competition Finalize",
        products: ["snbt"],
        campaignKind: "competition",
        enabled: true,
        redeemStatus: "ended",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: NOW - 24 * 60 * 60 * 1000,
        endsAt: campaignEndsAt,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "competition-finalize",
        label: "Competition Finalize",
        enabled: true,
      });
      const grantId = await ctx.db.insert("tryoutAccessGrants", {
        campaignId,
        linkId,
        userId: identity.userId,
        redeemedAt: NOW - 60 * 60 * 1000,
        endsAt: campaignEndsAt,
        status: "active",
      });

      await ctx.db.insert("tryoutAccessProductGrants", {
        campaignId,
        grantId,
        product: "snbt",
        status: "active",
        userId: identity.userId,
        endsAt: campaignEndsAt,
      });

      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        accessKind: "event",
        accessCampaignId: campaignId,
        accessCampaignKind: "competition",
        accessGrantId: grantId,
        accessEndsAt: campaignEndsAt,
        countsForCompetition: true,
        scoreStatus: "official",
        status: "in-progress",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 20,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [],
        totalCorrect: 0,
        totalQuestions: 0,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW - 60 * 60 * 1000,
        expiresAt: campaignEndsAt,
        lastActivityAt: NOW - 60 * 1000,
        completedAt: null,
        endReason: null,
      });
      return {
        campaignId,
        tryoutAttemptId,
      };
    });

    await t.mutation(
      internal.tryoutAccess.mutations.internal.competition
        .finalizeCompetitionCampaignResults,
      {
        campaignId: state.campaignId,
      }
    );

    const result = await t.query(async (ctx) => {
      return {
        campaign: await ctx.db.get("tryoutAccessCampaigns", state.campaignId),
        tryoutAttempt: await ctx.db.get(
          "tryoutAttempts",
          state.tryoutAttemptId
        ),
      };
    });

    expect(result.campaign?.resultsStatus).toBe("finalized");
    expect(result.campaign?.resultsFinalizedAt).toBeGreaterThanOrEqual(NOW);
    expect(result.tryoutAttempt?.status).toBe("expired");
  });

  it("extends active competition attempts when the campaign end is moved later", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "competition-window-sync",
      });
      const tryout = await insertTryoutSkeleton(ctx, "competition-window-sync");
      const originalEndsAt = NOW + 60 * 60 * 1000;
      const extendedEndsAt = NOW + 2 * 24 * 60 * 60 * 1000;
      const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "competition-window-sync",
        name: "Competition Window Sync",
        products: ["snbt"],
        campaignKind: "competition",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: NOW - 24 * 60 * 60 * 1000,
        endsAt: extendedEndsAt,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "competition-window-sync",
        label: "Competition Window Sync",
        enabled: true,
      });
      const grantId = await ctx.db.insert("tryoutAccessGrants", {
        campaignId,
        linkId,
        userId: identity.userId,
        redeemedAt: NOW - 60 * 1000,
        endsAt: originalEndsAt,
        status: "active",
      });

      await ctx.db.insert("tryoutAccessProductGrants", {
        campaignId,
        grantId,
        product: "snbt",
        status: "active",
        userId: identity.userId,
        endsAt: originalEndsAt,
      });

      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        accessKind: "event",
        accessCampaignId: campaignId,
        accessCampaignKind: "competition",
        accessGrantId: grantId,
        accessEndsAt: originalEndsAt,
        countsForCompetition: true,
        scoreStatus: "official",
        status: "in-progress",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 20,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [],
        totalCorrect: 0,
        totalQuestions: 0,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: originalEndsAt,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
      });
      await ctx.db.insert("userTryoutLatestAttempts", {
        userId: identity.userId,
        product: "snbt",
        locale: "id",
        tryoutId: tryout.tryoutId,
        attemptId: tryoutAttemptId,
        slug: "competition-window-sync",
        status: "in-progress",
        expiresAtMs: originalEndsAt,
        updatedAt: NOW,
      });

      return {
        campaignId,
        extendedEndsAt,
        tryoutAttemptId,
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      };
    });

    await t.mutation(
      internal.tryoutAccess.mutations.internal.competition
        .syncCompetitionAttemptWindows,
      {
        campaignId: state.campaignId,
      }
    );

    const result = await t.query(async (ctx) => {
      return await ctx.db.get("tryoutAttempts", state.tryoutAttemptId);
    });

    const latestAttempt = await t.query(async (ctx) => {
      return await ctx.db
        .query("userTryoutLatestAttempts")
        .withIndex("by_userId_and_product_and_locale_and_tryoutId", (q) =>
          q
            .eq("userId", state.userId)
            .eq("product", "snbt")
            .eq("locale", "id")
            .eq("tryoutId", state.tryoutId)
        )
        .unique();
    });

    expect(result?.accessEndsAt).toBe(state.extendedEndsAt);
    expect(result?.expiresAt).toBe(state.extendedEndsAt);
    expect(latestAttempt?.expiresAtMs).toBe(state.extendedEndsAt);
  });
});

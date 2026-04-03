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
});

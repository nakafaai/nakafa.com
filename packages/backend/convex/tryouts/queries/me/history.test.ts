import { api } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  ATTEMPT_WINDOW_MS,
  createTryoutTestConvex,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/queries/me/history", () => {
  it("returns numbered attempts and the single public status label for each row", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "attempt-history",
      });
      const tryout = await insertTryoutSkeleton(ctx, "attempt-history");
      const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "attempt-history",
        name: "Attempt History",
        products: ["snbt"],
        campaignKind: "competition",
        enabled: true,
        redeemStatus: "ended",
        resultsStatus: "finalized",
        resultsFinalizedAt: NOW,
        startsAt: NOW - 24 * 60 * 60 * 1000,
        endsAt: NOW - 1,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "attempt-history",
        label: "Attempt History",
        enabled: true,
      });
      const grantId = await ctx.db.insert("tryoutAccessGrants", {
        campaignId,
        linkId,
        userId: identity.userId,
        redeemedAt: NOW - 24 * 60 * 60 * 1000,
        endsAt: NOW - 1,
        status: "expired",
      });

      await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        accessKind: "event",
        accessCampaignId: campaignId,
        accessCampaignKind: "competition",
        accessGrantId: grantId,
        accessEndsAt: NOW - 1,
        countsForCompetition: true,
        scoreStatus: "provisional",
        status: "completed",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 20,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [0],
        totalCorrect: 10,
        totalQuestions: 20,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + 1,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "submitted",
      });
      const latestAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        accessKind: "subscription",
        countsForCompetition: false,
        scoreStatus: "official",
        status: "completed",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 20,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [0],
        totalCorrect: 12,
        totalQuestions: 20,
        theta: 1,
        thetaSE: 0.5,
        startedAt: NOW + 1,
        expiresAt: NOW + ATTEMPT_WINDOW_MS,
        lastActivityAt: NOW + 1,
        completedAt: NOW + 1,
        endReason: "submitted",
      });

      await ctx.db.insert("userTryoutLatestAttempts", {
        userId: identity.userId,
        product: "snbt",
        locale: "id",
        tryoutId: tryout.tryoutId,
        attemptId: latestAttemptId,
        slug: "attempt-history",
        status: "completed",
        expiresAtMs: NOW + ATTEMPT_WINDOW_MS,
        updatedAt: NOW + 1,
      });

      return identity;
    });

    const result = await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .query(api.tryouts.queries.me.history.getUserTryoutAttemptHistory, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "attempt-history",
      });

    expect(result).toEqual([
      expect.objectContaining({
        attemptNumber: 1,
        countsForCompetition: true,
        publicResultStatus: "final-event",
      }),
      expect.objectContaining({
        attemptNumber: 2,
        countsForCompetition: false,
        publicResultStatus: "verified-irt",
      }),
    ]);
  });
});

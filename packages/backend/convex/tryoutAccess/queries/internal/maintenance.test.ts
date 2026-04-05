import { internal } from "@repo/backend/convex/_generated/api";
import {
  createTryoutTestConvex,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryoutAccess/queries/internal/maintenance", () => {
  it("reports overdue campaign and grant integrity issues", async () => {
    const t = createTryoutTestConvex();

    await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth-access-integrity",
        credits: 0,
        creditsResetAt: NOW,
        email: "access-integrity@example.com",
        name: "Access Integrity",
        plan: "free",
      });
      const scheduledCampaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "scheduled-overdue-campaign",
        name: "Scheduled Overdue Campaign",
        products: ["snbt"],
        campaignKind: "access-pass",
        enabled: true,
        redeemStatus: "scheduled",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: NOW - 1,
        endsAt: NOW + 24 * 60 * 60 * 1000,
        grantDurationDays: 30,
      });
      await ctx.db.insert("tryoutAccessLinks", {
        campaignId: scheduledCampaignId,
        code: "scheduled-overdue-campaign",
        enabled: true,
        label: "Scheduled Overdue Campaign",
      });
      const activeCampaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "active-overdue-campaign",
        name: "Active Overdue Campaign",
        products: ["snbt"],
        campaignKind: "access-pass",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: NOW - 24 * 60 * 60 * 1000,
        endsAt: NOW - 1,
        grantDurationDays: 30,
      });
      const activeLinkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId: activeCampaignId,
        code: "active-overdue-campaign",
        enabled: true,
        label: "Active Overdue Campaign",
      });
      await ctx.db.insert("tryoutAccessGrants", {
        campaignId: activeCampaignId,
        endsAt: NOW - 1,
        linkId: activeLinkId,
        redeemedAt: NOW - 24 * 60 * 60 * 1000,
        status: "active",
        userId,
      });
      await ctx.db.insert("userTryoutEntitlements", {
        userId,
        product: "snbt",
        sourceKind: "access-pass",
        accessCampaignId: activeCampaignId,
        accessGrantId: undefined,
        subscriptionId: undefined,
        startsAt: NOW - 24 * 60 * 60 * 1000,
        endsAt: NOW - 1,
      });
      await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "pending-overdue-competition",
        name: "Pending Overdue Competition",
        products: ["snbt"],
        campaignKind: "competition",
        enabled: true,
        redeemStatus: "ended",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: NOW - 24 * 60 * 60 * 1000,
        endsAt: NOW - 1,
      });
    });

    const [campaigns, entitlements, grants] = await Promise.all([
      t.query(
        internal.tryoutAccess.queries.internal.maintenance
          .getTryoutAccessCampaignIntegrity,
        {
          nowMs: NOW,
          paginationOpts: {
            cursor: null,
            numItems: 100,
          },
        }
      ),
      t.query(
        internal.tryoutAccess.queries.internal.maintenance
          .getTryoutAccessEntitlementIntegrity,
        {
          nowMs: NOW,
          paginationOpts: {
            cursor: null,
            numItems: 100,
          },
        }
      ),
      t.query(
        internal.tryoutAccess.queries.internal.maintenance
          .getTryoutAccessGrantIntegrity,
        {
          nowMs: NOW,
          paginationOpts: {
            cursor: null,
            numItems: 100,
          },
        }
      ),
    ]);

    expect(campaigns).toMatchObject({
      isDone: true,
      overdueActiveCampaignCount: 1,
      overduePendingCompetitionCount: 1,
      overdueScheduledCampaignCount: 1,
    });
    expect(entitlements).toMatchObject({
      isDone: true,
      overdueEntitlementCount: 1,
    });
    expect(grants).toMatchObject({
      isDone: true,
      overdueActiveGrantCount: 1,
    });
  });
});

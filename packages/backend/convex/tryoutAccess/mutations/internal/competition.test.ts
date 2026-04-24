import { internal } from "@repo/backend/convex/_generated/api";
import { insertTryoutAccessCampaign } from "@repo/backend/convex/tryoutAccess/test.helpers";
import {
  createTryoutTestConvex,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it, vi } from "vitest";

describe("tryoutAccess/mutations/internal/competition", () => {
  it("finalizes ended pending competition campaigns", async () => {
    const t = createTryoutTestConvex();
    const campaignId = await t.mutation(
      async (ctx) =>
        await insertTryoutAccessCampaign(ctx, {
          slug: "competition-finalize",
          name: "Competition Finalize",
          targetProducts: ["snbt"],
          campaignKind: "competition",
          enabled: true,
          redeemStatus: "ended",
          resultsStatus: "pending",
          resultsFinalizedAt: null,
          startsAt: NOW - 24 * 60 * 60 * 1000,
          endsAt: NOW - 1,
        })
    );

    await t.mutation(
      internal.tryoutAccess.mutations.internal.competition
        .finalizeCompetitionCampaignResults,
      {
        campaignId,
      }
    );

    const campaign = await t.query(
      async (ctx) => await ctx.db.get("tryoutAccessCampaigns", campaignId)
    );

    expect(campaign?.resultsStatus).toBe("finalized");
    expect(campaign?.resultsFinalizedAt).toBeGreaterThanOrEqual(NOW);
  });

  it("does not change already finalized competition campaigns", async () => {
    const t = createTryoutTestConvex();
    const campaignId = await t.mutation(
      async (ctx) =>
        await insertTryoutAccessCampaign(ctx, {
          slug: "competition-pending-not-claimed",
          name: "Competition Pending Not Claimed",
          targetProducts: ["snbt"],
          campaignKind: "competition",
          enabled: true,
          redeemStatus: "ended",
          resultsStatus: "finalized",
          resultsFinalizedAt: NOW - 1000,
          startsAt: NOW - 24 * 60 * 60 * 1000,
          endsAt: NOW - 1,
        })
    );

    await t.mutation(
      internal.tryoutAccess.mutations.internal.competition
        .finalizeCompetitionCampaignResults,
      {
        campaignId,
      }
    );

    const campaign = await t.query(
      async (ctx) => await ctx.db.get("tryoutAccessCampaigns", campaignId)
    );

    expect(campaign?.resultsStatus).toBe("finalized");
    expect(campaign?.resultsFinalizedAt).toBe(NOW - 1000);
  });

  it("does not finalize competition campaigns before they end", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createTryoutTestConvex();
    const campaignId = await t.mutation(
      async (ctx) =>
        await insertTryoutAccessCampaign(ctx, {
          slug: "competition-not-finished",
          name: "Competition Not Finished",
          targetProducts: ["snbt"],
          campaignKind: "competition",
          enabled: true,
          redeemStatus: "active",
          resultsStatus: "pending",
          resultsFinalizedAt: null,
          startsAt: NOW - 24 * 60 * 60 * 1000,
          endsAt: NOW + 60 * 60 * 1000,
        })
    );

    await t.mutation(
      internal.tryoutAccess.mutations.internal.competition
        .finalizeCompetitionCampaignResults,
      {
        campaignId,
      }
    );

    const campaign = await t.query(
      async (ctx) => await ctx.db.get("tryoutAccessCampaigns", campaignId)
    );

    expect(campaign?.resultsStatus).toBe("pending");
    expect(campaign?.resultsFinalizedAt).toBeNull();
  });
});

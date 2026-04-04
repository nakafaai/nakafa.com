import { internal } from "@repo/backend/convex/_generated/api";
import {
  createTryoutTestConvex,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it, vi } from "vitest";

describe("tryoutAccess/mutations/internal/competition", () => {
  it("finalizes ended competition campaigns", async () => {
    const t = createTryoutTestConvex();
    const campaignId = await t.mutation(async (ctx) => {
      return await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "competition-finalize",
        name: "Competition Finalize",
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

    await t.mutation(
      internal.tryoutAccess.mutations.internal.competition
        .finalizeCompetitionCampaignResults,
      {
        campaignId,
      }
    );

    const campaign = await t.query(async (ctx) => {
      return await ctx.db.get("tryoutAccessCampaigns", campaignId);
    });

    expect(campaign?.resultsStatus).toBe("finalized");
    expect(campaign?.resultsFinalizedAt).toBeGreaterThanOrEqual(NOW);
  });

  it("does not finalize competition campaigns before they end", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const t = createTryoutTestConvex();
    const campaignId = await t.mutation(async (ctx) => {
      return await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "competition-not-finished",
        name: "Competition Not Finished",
        products: ["snbt"],
        campaignKind: "competition",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: NOW - 24 * 60 * 60 * 1000,
        endsAt: NOW + 60 * 60 * 1000,
      });
    });

    await t.mutation(
      internal.tryoutAccess.mutations.internal.competition
        .finalizeCompetitionCampaignResults,
      {
        campaignId,
      }
    );

    const campaign = await t.query(async (ctx) => {
      return await ctx.db.get("tryoutAccessCampaigns", campaignId);
    });

    expect(campaign?.resultsStatus).toBe("pending");
    expect(campaign?.resultsFinalizedAt).toBeNull();

    vi.useRealTimers();
  });
});

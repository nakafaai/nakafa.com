import { internal } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  createTryoutTestConvex,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryoutAccess/mutations/internal/status", () => {
  it("clamps stored competition grants to the campaign end", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const currentTime = Date.now();
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "sync-campaign-grants",
      });
      const campaignEndsAt = currentTime + 24 * 60 * 60 * 1000;
      const oldGrantEndsAt = currentTime + 90 * 24 * 60 * 60 * 1000;
      const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "sync-campaign-grants",
        name: "Sync Campaign Grants",
        products: ["snbt"],
        campaignKind: "competition",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: currentTime - 60 * 1000,
        endsAt: campaignEndsAt,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "sync-campaign-grants",
        label: "Sync Campaign Grants",
        enabled: true,
      });
      const grantId = await ctx.db.insert("tryoutAccessGrants", {
        campaignId,
        linkId,
        userId: identity.userId,
        redeemedAt: currentTime,
        endsAt: oldGrantEndsAt,
        status: "active",
      });
      const productGrantId = await ctx.db.insert("tryoutAccessProductGrants", {
        campaignId,
        grantId,
        product: "snbt",
        status: "active",
        userId: identity.userId,
        endsAt: oldGrantEndsAt,
      });

      return {
        campaignEndsAt,
        campaignId,
        grantId,
        productGrantId,
      };
    });

    await t.mutation(
      internal.tryoutAccess.mutations.internal.status.syncCampaignGrantStatuses,
      {
        campaignId: state.campaignId,
      }
    );

    const result = await t.query(async (ctx) => {
      return {
        grant: await ctx.db.get("tryoutAccessGrants", state.grantId),
        productGrant: await ctx.db.get(
          "tryoutAccessProductGrants",
          state.productGrantId
        ),
      };
    });

    expect(result.grant?.endsAt).toBe(state.campaignEndsAt);
    expect(result.productGrant?.endsAt).toBe(state.campaignEndsAt);
    expect(result.grant?.status).toBe("active");
    expect(result.productGrant?.status).toBe("active");
  });
});

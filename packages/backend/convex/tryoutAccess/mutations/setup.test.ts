import { internal } from "@repo/backend/convex/_generated/api";
import {
  createTryoutTestConvex,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryoutAccess/mutations/setup", () => {
  it("stores competition campaigns without a grant duration", async () => {
    const t = createTryoutTestConvex();

    const result = await t.mutation(
      internal.tryoutAccess.mutations.setup.upsertCampaignAndLink,
      {
        campaign: {
          slug: "competition-yim",
          name: "Competition YIM",
          products: ["snbt"],
          campaignKind: "competition",
          enabled: true,
          startsAt: NOW,
          endsAt: NOW + 24 * 60 * 60 * 1000,
        },
        link: {
          code: "competition-yim",
          label: "Competition YIM",
          enabled: true,
        },
      }
    );

    const campaign = await t.query(async (ctx) => {
      return await ctx.db.get("tryoutAccessCampaigns", result.campaignId);
    });

    expect(campaign?.campaignKind).toBe("competition");
    expect(campaign?.grantDurationDays).toBeUndefined();
    expect(campaign?.resultsStatus).toBe("pending");
    expect(campaign?.resultsFinalizedAt).toBeNull();
  });

  it("stores access-pass campaigns with a positive grant duration", async () => {
    const t = createTryoutTestConvex();

    const result = await t.mutation(
      internal.tryoutAccess.mutations.setup.upsertCampaignAndLink,
      {
        campaign: {
          slug: "access-pass-yim",
          name: "Access Pass YIM",
          products: ["snbt"],
          campaignKind: "access-pass",
          enabled: true,
          startsAt: NOW,
          endsAt: NOW + 24 * 60 * 60 * 1000,
          grantDurationDays: 30,
        },
        link: {
          code: "access-pass-yim",
          label: "Access Pass YIM",
          enabled: true,
        },
      }
    );

    const campaign = await t.query(async (ctx) => {
      return await ctx.db.get("tryoutAccessCampaigns", result.campaignId);
    });

    expect(campaign?.campaignKind).toBe("access-pass");
    expect(campaign?.grantDurationDays).toBe(30);
    expect(campaign?.resultsStatus).toBe("pending");
  });
});

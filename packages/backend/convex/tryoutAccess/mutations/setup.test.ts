import { internal } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
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

  it("does not allow changing the campaign kind after creation", async () => {
    const t = createTryoutTestConvex();

    await t.mutation(
      internal.tryoutAccess.mutations.setup.upsertCampaignAndLink,
      {
        campaign: {
          slug: "immutable-kind",
          name: "Immutable Kind",
          products: ["snbt"],
          campaignKind: "competition",
          enabled: true,
          startsAt: NOW,
          endsAt: NOW + 24 * 60 * 60 * 1000,
        },
        link: {
          code: "immutable-kind",
          label: "Immutable Kind",
          enabled: true,
        },
      }
    );

    await expect(
      t.mutation(internal.tryoutAccess.mutations.setup.upsertCampaignAndLink, {
        campaign: {
          slug: "immutable-kind",
          name: "Immutable Kind",
          products: ["snbt"],
          campaignKind: "access-pass",
          enabled: true,
          startsAt: NOW,
          endsAt: NOW + 24 * 60 * 60 * 1000,
          grantDurationDays: 30,
        },
        link: {
          code: "immutable-kind",
          label: "Immutable Kind",
          enabled: true,
        },
      })
    ).rejects.toThrow("CAMPAIGN_KIND_IMMUTABLE");
  });

  it("does not allow overlapping competition campaigns for the same product", async () => {
    const t = createTryoutTestConvex();

    await t.mutation(
      internal.tryoutAccess.mutations.setup.upsertCampaignAndLink,
      {
        campaign: {
          slug: "overlap-first",
          name: "Overlap First",
          products: ["snbt"],
          campaignKind: "competition",
          enabled: true,
          startsAt: NOW,
          endsAt: NOW + 24 * 60 * 60 * 1000,
        },
        link: {
          code: "overlap-first",
          label: "Overlap First",
          enabled: true,
        },
      }
    );

    await expect(
      t.mutation(internal.tryoutAccess.mutations.setup.upsertCampaignAndLink, {
        campaign: {
          slug: "overlap-second",
          name: "Overlap Second",
          products: ["snbt"],
          campaignKind: "competition",
          enabled: true,
          startsAt: NOW + 60 * 60 * 1000,
          endsAt: NOW + 2 * 24 * 60 * 60 * 1000,
        },
        link: {
          code: "overlap-second",
          label: "Overlap Second",
          enabled: true,
        },
      })
    ).rejects.toThrow("OVERLAPPING_COMPETITION_CAMPAIGN");
  });

  it("does not allow changing campaign policy after it has been redeemed", async () => {
    const t = createTryoutTestConvex();

    await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "locked-policy",
      });
      const result = await ctx.runMutation(
        internal.tryoutAccess.mutations.setup.upsertCampaignAndLink,
        {
          campaign: {
            slug: "locked-policy",
            name: "Locked Policy",
            products: ["snbt"],
            campaignKind: "access-pass",
            enabled: true,
            startsAt: NOW,
            endsAt: NOW + 24 * 60 * 60 * 1000,
            grantDurationDays: 30,
          },
          link: {
            code: "locked-policy",
            label: "Locked Policy",
            enabled: true,
          },
        }
      );

      await ctx.db.insert("tryoutAccessGrants", {
        campaignId: result.campaignId,
        linkId: result.linkId,
        userId: identity.userId,
        redeemedAt: NOW,
        endsAt: NOW + 30 * 24 * 60 * 60 * 1000,
        status: "active",
      });
    });

    await expect(
      t.mutation(internal.tryoutAccess.mutations.setup.upsertCampaignAndLink, {
        campaign: {
          slug: "locked-policy",
          name: "Locked Policy",
          products: ["snbt"],
          campaignKind: "access-pass",
          enabled: true,
          startsAt: NOW,
          endsAt: NOW + 2 * 24 * 60 * 60 * 1000,
          grantDurationDays: 45,
        },
        link: {
          code: "locked-policy",
          label: "Locked Policy",
          enabled: true,
        },
      })
    ).rejects.toThrow("CAMPAIGN_POLICY_IMMUTABLE");
  });
});

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

    const state = await t.query(async (ctx) => {
      return {
        campaign: await ctx.db.get("tryoutAccessCampaigns", result.campaignId),
        campaignProducts: await ctx.db
          .query("tryoutAccessCampaignProducts")
          .withIndex("by_campaignId", (q) =>
            q.eq("campaignId", result.campaignId)
          )
          .collect(),
      };
    });

    expect(state.campaign?.campaignKind).toBe("competition");
    expect(state.campaign?.grantDurationDays).toBeUndefined();
    expect(state.campaign?.resultsStatus).toBe("pending");
    expect(state.campaign?.resultsFinalizedAt).toBeNull();
    expect("products" in (state.campaign ?? {})).toBe(false);
    expect(state.campaignProducts).toEqual([
      expect.objectContaining({
        campaignId: result.campaignId,
        campaignKind: "competition",
        product: "snbt",
      }),
    ]);
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

  it("does not allow reusing a finished competition campaign for a new window", async () => {
    const t = createTryoutTestConvex();

    await t.mutation(async (ctx) => {
      const result = await ctx.runMutation(
        internal.tryoutAccess.mutations.setup.upsertCampaignAndLink,
        {
          campaign: {
            slug: "finished-competition-window",
            name: "Finished Competition Window",
            products: ["snbt"],
            campaignKind: "competition",
            enabled: true,
            startsAt: NOW,
            endsAt: NOW + 24 * 60 * 60 * 1000,
          },
          link: {
            code: "finished-competition-window",
            label: "Finished Competition Window",
            enabled: true,
          },
        }
      );

      await ctx.db.patch("tryoutAccessCampaigns", result.campaignId, {
        resultsFinalizedAt: NOW + 2 * 24 * 60 * 60 * 1000,
        resultsStatus: "finalized",
      });
    });

    await expect(
      t.mutation(internal.tryoutAccess.mutations.setup.upsertCampaignAndLink, {
        campaign: {
          slug: "finished-competition-window",
          name: "Finished Competition Window",
          products: ["snbt"],
          campaignKind: "competition",
          enabled: true,
          startsAt: NOW + 7 * 24 * 60 * 60 * 1000,
          endsAt: NOW + 8 * 24 * 60 * 60 * 1000,
        },
        link: {
          code: "finished-competition-window",
          label: "Finished Competition Window",
          enabled: true,
        },
      })
    ).rejects.toThrow("CAMPAIGN_LIFECYCLE_IMMUTABLE");
  });
});

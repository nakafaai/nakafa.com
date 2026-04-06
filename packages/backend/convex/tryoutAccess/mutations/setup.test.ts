import { api, internal } from "@repo/backend/convex/_generated/api";
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
          targetProducts: ["snbt"],
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
    expect(state.campaign?.firstRedeemedAt).toBeNull();
    expect(state.campaign?.grantDurationDays).toBeUndefined();
    expect(state.campaign?.resultsStatus).toBe("pending");
    expect(state.campaign?.resultsFinalizedAt).toBeNull();
    expect("products" in (state.campaign ?? {})).toBe(false);
    expect("targetProducts" in (state.campaign ?? {})).toBe(false);
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
          targetProducts: ["snbt"],
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
          targetProducts: ["snbt"],
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
          targetProducts: ["snbt"],
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
          targetProducts: ["snbt"],
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
          targetProducts: ["snbt"],
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

  it("rejects overlaps with an older long-running competition campaign", async () => {
    const t = createTryoutTestConvex();

    await t.mutation(
      internal.tryoutAccess.mutations.setup.upsertCampaignAndLink,
      {
        campaign: {
          slug: "overlap-long-running",
          name: "Overlap Long Running",
          targetProducts: ["snbt"],
          campaignKind: "competition",
          enabled: true,
          startsAt: NOW,
          endsAt: NOW + 10 * 24 * 60 * 60 * 1000,
        },
        link: {
          code: "overlap-long-running",
          label: "Overlap Long Running",
          enabled: true,
        },
      }
    );

    for (let index = 0; index < 4; index += 1) {
      const startsAt = NOW + (index + 10) * 24 * 60 * 60 * 1000;

      await t.mutation(
        internal.tryoutAccess.mutations.setup.upsertCampaignAndLink,
        {
          campaign: {
            slug: `overlap-non-overlap-${index}`,
            name: `Overlap Non Overlap ${index}`,
            targetProducts: ["snbt"],
            campaignKind: "competition",
            enabled: true,
            startsAt,
            endsAt: startsAt + 24 * 60 * 60 * 1000,
          },
          link: {
            code: `overlap-non-overlap-${index}`,
            label: `Overlap Non Overlap ${index}`,
            enabled: true,
          },
        }
      );
    }

    await expect(
      t.mutation(internal.tryoutAccess.mutations.setup.upsertCampaignAndLink, {
        campaign: {
          slug: "overlap-hidden-old-campaign",
          name: "Overlap Hidden Old Campaign",
          targetProducts: ["snbt"],
          campaignKind: "competition",
          enabled: true,
          startsAt: NOW + 5 * 24 * 60 * 60 * 1000,
          endsAt: NOW + 11 * 24 * 60 * 60 * 1000,
        },
        link: {
          code: "overlap-hidden-old-campaign",
          label: "Overlap Hidden Old Campaign",
          enabled: true,
        },
      })
    ).rejects.toThrow("OVERLAPPING_COMPETITION_CAMPAIGN");
  });

  it("does not allow changing campaign policy after it has been redeemed", async () => {
    const t = createTryoutTestConvex();
    const currentTime = Date.now();
    const identity = await t.mutation(async (ctx) => {
      const state = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "locked-policy",
      });

      await ctx.runMutation(
        internal.tryoutAccess.mutations.setup.upsertCampaignAndLink,
        {
          campaign: {
            slug: "locked-policy",
            name: "Locked Policy",
            targetProducts: ["snbt"],
            campaignKind: "access-pass",
            enabled: true,
            startsAt: currentTime - 60 * 1000,
            endsAt: currentTime + 24 * 60 * 60 * 1000,
            grantDurationDays: 30,
          },
          link: {
            code: "locked-policy",
            label: "Locked Policy",
            enabled: true,
          },
        }
      );

      return state;
    });

    await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.tryoutAccess.mutations.redeem.redeemEventAccess, {
        code: "locked-policy",
      });

    const redeemedCampaign = await t.query(async (ctx) => {
      return await ctx.db
        .query("tryoutAccessCampaigns")
        .withIndex("by_slug", (q) => q.eq("slug", "locked-policy"))
        .unique();
    });

    expect(redeemedCampaign?.firstRedeemedAt).not.toBeNull();

    await expect(
      t.mutation(internal.tryoutAccess.mutations.setup.upsertCampaignAndLink, {
        campaign: {
          slug: "locked-policy",
          name: "Locked Policy",
          targetProducts: ["snbt"],
          campaignKind: "access-pass",
          enabled: true,
          startsAt: currentTime - 60 * 1000,
          endsAt: currentTime + 2 * 24 * 60 * 60 * 1000,
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

  it("keeps campaign policy locked after redeemed grants are cleaned up", async () => {
    const t = createTryoutTestConvex();
    const currentTime = Date.now();
    const identity = await t.mutation(async (ctx) => {
      const state = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "locked-policy-cleanup",
      });

      await ctx.runMutation(
        internal.tryoutAccess.mutations.setup.upsertCampaignAndLink,
        {
          campaign: {
            slug: "locked-policy-cleanup",
            name: "Locked Policy Cleanup",
            targetProducts: ["snbt"],
            campaignKind: "access-pass",
            enabled: true,
            startsAt: currentTime - 60 * 1000,
            endsAt: currentTime + 24 * 60 * 60 * 1000,
            grantDurationDays: 30,
          },
          link: {
            code: "locked-policy-cleanup",
            label: "Locked Policy Cleanup",
            enabled: true,
          },
        }
      );

      return state;
    });

    await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.tryoutAccess.mutations.redeem.redeemEventAccess, {
        code: "locked-policy-cleanup",
      });

    await t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
      userId: identity.userId,
    });

    await expect(
      t.mutation(internal.tryoutAccess.mutations.setup.upsertCampaignAndLink, {
        campaign: {
          slug: "locked-policy-cleanup",
          name: "Locked Policy Cleanup",
          targetProducts: ["snbt"],
          campaignKind: "access-pass",
          enabled: true,
          startsAt: currentTime - 60 * 1000,
          endsAt: currentTime + 2 * 24 * 60 * 60 * 1000,
          grantDurationDays: 45,
        },
        link: {
          code: "locked-policy-cleanup",
          label: "Locked Policy Cleanup",
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
            targetProducts: ["snbt"],
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
          targetProducts: ["snbt"],
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

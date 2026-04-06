import { api, internal } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  createTryoutTestConvex,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryoutAccess/mutations/redeem", () => {
  it("redeems competition access until the campaign end", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const currentTime = Date.now();
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "redeem-competition",
      });

      await ctx.runMutation(
        internal.tryoutAccess.mutations.setup.upsertCampaignAndLink,
        {
          campaign: {
            slug: "redeem-competition",
            name: "Redeem Competition",
            targetProducts: ["snbt"],
            campaignKind: "competition",
            enabled: true,
            startsAt: currentTime - 60 * 1000,
            endsAt: currentTime + 2 * 24 * 60 * 60 * 1000,
          },
          link: {
            code: "redeem-competition",
            label: "Redeem Competition",
            enabled: true,
          },
        }
      );

      return {
        ...identity,
        expectedEndsAt: currentTime + 2 * 24 * 60 * 60 * 1000,
      };
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.tryoutAccess.mutations.redeem.redeemEventAccess, {
        code: "redeem-competition",
      });

    expect(result.kind).toBe("active");
    expect(result.endsAt).toBe(identity.expectedEndsAt);
  });

  it("redeems access-pass access using the configured grant duration", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const currentTime = Date.now();
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "redeem-access-pass",
      });

      await ctx.runMutation(
        internal.tryoutAccess.mutations.setup.upsertCampaignAndLink,
        {
          campaign: {
            slug: "redeem-access-pass",
            name: "Redeem Access Pass",
            targetProducts: ["snbt"],
            campaignKind: "access-pass",
            enabled: true,
            startsAt: currentTime - 60 * 1000,
            endsAt: currentTime + 24 * 60 * 60 * 1000,
            grantDurationDays: 30,
          },
          link: {
            code: "redeem-access-pass",
            label: "Redeem Access Pass",
            enabled: true,
          },
        }
      );

      return {
        ...identity,
        earliestEndsAt: currentTime + 30 * 24 * 60 * 60 * 1000,
      };
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.tryoutAccess.mutations.redeem.redeemEventAccess, {
        code: "redeem-access-pass",
      });

    expect(result.kind).toBe("active");
    expect(result.endsAt).toBeGreaterThanOrEqual(identity.earliestEndsAt);
    expect(result.endsAt).toBeLessThan(identity.earliestEndsAt + 5000);
  });

  it("redeems once the real campaign window has started even if stored redeemStatus is still scheduled", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const currentTime = Date.now();
      const state = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "redeem-stale-scheduled",
      });
      const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "redeem-stale-scheduled",
        name: "Redeem Stale Scheduled",
        campaignKind: "competition",
        enabled: true,
        redeemStatus: "scheduled",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        firstRedeemedAt: null,
        startsAt: currentTime - 60 * 1000,
        endsAt: currentTime + 24 * 60 * 60 * 1000,
      });

      await ctx.db.insert("tryoutAccessCampaignProducts", {
        campaignId,
        campaignKind: "competition",
        endsAt: currentTime + 24 * 60 * 60 * 1000,
        product: "snbt",
        startsAt: currentTime - 60 * 1000,
      });

      await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "redeem-stale-scheduled",
        label: "Redeem Stale Scheduled",
        enabled: true,
      });

      return state;
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.tryoutAccess.mutations.redeem.redeemEventAccess, {
        code: "redeem-stale-scheduled",
      });

    expect(result.kind).toBe("active");
  });

  it("rejects once the real campaign window has ended even if stored redeemStatus is still active", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const currentTime = Date.now();
      const state = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "redeem-stale-active",
      });
      const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "redeem-stale-active",
        name: "Redeem Stale Active",
        campaignKind: "competition",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        firstRedeemedAt: null,
        startsAt: currentTime - 2 * 24 * 60 * 60 * 1000,
        endsAt: currentTime - 60 * 1000,
      });

      await ctx.db.insert("tryoutAccessCampaignProducts", {
        campaignId,
        campaignKind: "competition",
        endsAt: currentTime - 60 * 1000,
        product: "snbt",
        startsAt: currentTime - 2 * 24 * 60 * 60 * 1000,
      });

      await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "redeem-stale-active",
        label: "Redeem Stale Active",
        enabled: true,
      });

      return state;
    });

    await expect(
      t
        .withIdentity({
          subject: identity.authUserId,
          sessionId: identity.sessionId,
        })
        .mutation(api.tryoutAccess.mutations.redeem.redeemEventAccess, {
          code: "redeem-stale-active",
        })
    ).rejects.toThrow("EVENT_ENDED");
  });
});

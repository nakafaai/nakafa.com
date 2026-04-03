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
            products: ["snbt"],
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
            products: ["snbt"],
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
});

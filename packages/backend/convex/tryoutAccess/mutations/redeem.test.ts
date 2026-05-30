import { api, internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import { insertTryoutAccessCampaign } from "@repo/backend/convex/tryoutAccess/test.helpers";
import {
  createTryoutTestConvex,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

const dayMs = 24 * 60 * 60 * 1000;
const minuteMs = 60 * 1000;

interface SeedAccessEventOptions {
  campaignEnabled?: boolean;
  campaignKind?: Doc<"tryoutAccessCampaigns">["campaignKind"];
  endsAt?: number;
  firstRedeemedAt?: number | null;
  grantDurationDays?: number;
  linkEnabled?: boolean;
  redeemStatus?: Doc<"tryoutAccessCampaigns">["redeemStatus"];
  startsAt?: number;
  suffix: string;
  targetProducts?: Doc<"tryoutAccessCampaignProducts">["product"][];
}

/** Seeds one authenticated user and one event access campaign/link pair. */
async function seedAccessEvent(
  ctx: MutationCtx,
  {
    campaignEnabled = true,
    campaignKind = "competition",
    endsAt = NOW + dayMs,
    firstRedeemedAt = null,
    grantDurationDays,
    linkEnabled = true,
    redeemStatus = "active",
    startsAt = NOW - minuteMs,
    suffix,
    targetProducts = ["snbt"],
  }: SeedAccessEventOptions
) {
  const identity = await seedAuthenticatedUser(ctx, {
    now: NOW,
    suffix,
  });
  const campaignId = await insertTryoutAccessCampaign(ctx, {
    campaignKind,
    enabled: campaignEnabled,
    endsAt,
    firstRedeemedAt,
    grantDurationDays,
    name: `Redeem ${suffix}`,
    redeemStatus,
    resultsFinalizedAt: null,
    resultsStatus: "pending",
    slug: suffix,
    startsAt,
    targetProducts,
  });
  const linkId = await ctx.db.insert("tryoutAccessLinks", {
    campaignId,
    code: suffix,
    label: `Redeem ${suffix}`,
    enabled: linkEnabled,
  });

  return {
    ...identity,
    campaignId,
    linkId,
  };
}

describe("tryoutAccess/mutations/redeem", () => {
  it("redeems competition access until the campaign end", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
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
            startsAt: NOW - 60 * 1000,
            endsAt: NOW + 2 * 24 * 60 * 60 * 1000,
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
        expectedEndsAt: NOW + 2 * 24 * 60 * 60 * 1000,
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

    if (result.kind !== "active") {
      throw new Error(`Expected active redemption, got ${result.kind}.`);
    }

    expect(result.endsAt).toBe(identity.expectedEndsAt);
  });

  it("redeems access-pass access using the configured grant duration", async () => {
    const t = createTryoutTestConvex();
    const grantDurationMs = 7 * 24 * 60 * 60 * 1000;
    const identity = await t.mutation(async (ctx) => {
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
            startsAt: NOW - 60 * 1000,
            endsAt: NOW + 24 * 60 * 60 * 1000,
            grantDurationDays: 7,
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
      };
    });

    const redeemStartedAt = Date.now();
    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.tryoutAccess.mutations.redeem.redeemEventAccess, {
        code: "redeem-access-pass",
      });
    const redeemFinishedAt = Date.now();

    if (result.kind !== "active") {
      throw new Error(`Expected active redemption, got ${result.kind}.`);
    }

    expect(result.endsAt).toBeGreaterThanOrEqual(
      redeemStartedAt + grantDurationMs
    );
    expect(result.endsAt).toBeLessThanOrEqual(
      redeemFinishedAt + grantDurationMs
    );
  });

  it("returns already-active when the current user already has an active grant", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const state = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "redeem-already-active",
      });

      await ctx.runMutation(
        internal.tryoutAccess.mutations.setup.upsertCampaignAndLink,
        {
          campaign: {
            slug: "redeem-already-active",
            name: "Redeem Already Active",
            targetProducts: ["snbt"],
            campaignKind: "competition",
            enabled: true,
            startsAt: NOW - 60 * 1000,
            endsAt: NOW + 24 * 60 * 60 * 1000,
          },
          link: {
            code: "redeem-already-active",
            label: "Redeem Already Active",
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
        code: "redeem-already-active",
      });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.tryoutAccess.mutations.redeem.redeemEventAccess, {
        code: "redeem-already-active",
      });

    expect(result.kind).toBe("already-active");
  });

  it("fails when a redeemable campaign has no products", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const state = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "redeem-empty-products",
      });
      const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "redeem-empty-products",
        name: "Redeem Empty Products",
        campaignKind: "competition",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        firstRedeemedAt: null,
        startsAt: NOW - 60 * 1000,
        endsAt: NOW + 24 * 60 * 60 * 1000,
      });

      await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "redeem-empty-products",
        label: "Redeem Empty Products",
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
          code: "redeem-empty-products",
        })
    ).rejects.toThrow("EVENT_PRODUCTS_REQUIRED");
  });

  it("returns not-found when the code does not exist", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "redeem-not-found",
      })
    );

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.tryoutAccess.mutations.redeem.redeemEventAccess, {
        code: "missing-redeem-code",
      });

    expect(result).toEqual({ kind: "not-found" });
  });

  it("returns disabled when the link is disabled", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation((ctx) =>
      seedAccessEvent(ctx, {
        linkEnabled: false,
        suffix: "redeem-disabled-link",
      })
    );

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.tryoutAccess.mutations.redeem.redeemEventAccess, {
        code: "redeem-disabled-link",
      });

    expect(result).toEqual({
      kind: "disabled",
      name: "Redeem redeem-disabled-link",
    });
  });

  it("returns not-started before the real campaign window opens", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation((ctx) =>
      seedAccessEvent(ctx, {
        endsAt: NOW + 2 * dayMs,
        redeemStatus: "scheduled",
        startsAt: NOW + dayMs,
        suffix: "redeem-not-started",
      })
    );

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.tryoutAccess.mutations.redeem.redeemEventAccess, {
        code: "redeem-not-started",
      });

    expect(result).toEqual({
      kind: "not-started",
      name: "Redeem redeem-not-started",
    });
  });

  it("returns used when the current user already has an expired grant", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const state = await seedAccessEvent(ctx, {
        suffix: "redeem-used-expired",
      });
      const endsAt = NOW - minuteMs;

      await ctx.db.insert("tryoutAccessGrants", {
        campaignId: state.campaignId,
        endsAt,
        linkId: state.linkId,
        redeemedAt: NOW - 2 * minuteMs,
        status: "expired",
        userId: state.userId,
      });

      return {
        ...state,
        endsAt,
      };
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.tryoutAccess.mutations.redeem.redeemEventAccess, {
        code: "redeem-used-expired",
      });

    expect(result).toEqual({
      kind: "used",
      endsAt: identity.endsAt,
      name: "Redeem redeem-used-expired",
    });
  });

  it("fails when an access-pass campaign has no grant duration", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation((ctx) =>
      seedAccessEvent(ctx, {
        campaignKind: "access-pass",
        suffix: "redeem-access-pass-no-duration",
      })
    );

    await expect(
      t
        .withIdentity({
          subject: identity.authUserId,
          sessionId: identity.sessionId,
        })
        .mutation(api.tryoutAccess.mutations.redeem.redeemEventAccess, {
          code: "redeem-access-pass-no-duration",
        })
    ).rejects.toThrow("INVALID_CAMPAIGN_WINDOW");
  });

  it("redeems without rewriting the campaign first redemption marker", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation((ctx) =>
      seedAccessEvent(ctx, {
        firstRedeemedAt: NOW - dayMs,
        suffix: "redeem-first-marker-set",
      })
    );

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.tryoutAccess.mutations.redeem.redeemEventAccess, {
        code: "redeem-first-marker-set",
      });

    if (result.kind !== "active") {
      throw new Error(`Expected active redemption, got ${result.kind}.`);
    }

    const campaign = await t.run(async (ctx) =>
      ctx.db.get(identity.campaignId)
    );

    expect(campaign?.firstRedeemedAt).toBe(NOW - dayMs);
  });

  it("redeems once the real campaign window has started even if stored redeemStatus is still scheduled", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
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
        startsAt: NOW - 60 * 1000,
        endsAt: NOW + 24 * 60 * 60 * 1000,
      });

      await ctx.db.insert("tryoutAccessCampaignProducts", {
        campaignId,
        campaignKind: "competition",
        endsAt: NOW + 24 * 60 * 60 * 1000,
        product: "snbt",
        startsAt: NOW - 60 * 1000,
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
        startsAt: NOW - 2 * 24 * 60 * 60 * 1000,
        endsAt: NOW - 60 * 1000,
      });

      await ctx.db.insert("tryoutAccessCampaignProducts", {
        campaignId,
        campaignKind: "competition",
        endsAt: NOW - 60 * 1000,
        product: "snbt",
        startsAt: NOW - 2 * 24 * 60 * 60 * 1000,
      });

      await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "redeem-stale-active",
        label: "Redeem Stale Active",
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
        code: "redeem-stale-active",
      });

    expect(result).toEqual({
      kind: "ended",
      name: "Redeem Stale Active",
    });
  });
});

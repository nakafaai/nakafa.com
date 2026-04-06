import { internal } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import { syncTryoutAccessGrantStatus } from "@repo/backend/convex/tryoutAccess/helpers/access";
import { insertTryoutAccessCampaign } from "@repo/backend/convex/tryoutAccess/test.helpers";
import {
  createTryoutTestConvex,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it, vi } from "vitest";

describe("tryoutAccess/mutations/internal/status", () => {
  it("keeps immutable competition grants and syncs active entitlements", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const currentTime = NOW;
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "sync-campaign-grants",
      });
      const campaignEndsAt = currentTime + 24 * 60 * 60 * 1000;
      const oldGrantEndsAt = currentTime + 90 * 24 * 60 * 60 * 1000;
      const campaignId = await insertTryoutAccessCampaign(ctx, {
        slug: "sync-campaign-grants",
        name: "Sync Campaign Grants",
        targetProducts: ["snbt"],
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

      return {
        campaignId,
        grantId,
        oldGrantEndsAt,
      };
    });

    await t.mutation(async (ctx) => {
      const grant = await ctx.db.get("tryoutAccessGrants", state.grantId);

      if (!grant) {
        throw new Error("expected grant to exist");
      }

      await syncTryoutAccessGrantStatus(ctx.db, grant, NOW);
    });

    const result = await t.query(async (ctx) => {
      return {
        entitlement: await ctx.db
          .query("userTryoutEntitlements")
          .withIndex("by_accessGrantId", (q) =>
            q.eq("accessGrantId", state.grantId)
          )
          .unique(),
        grant: await ctx.db.get("tryoutAccessGrants", state.grantId),
      };
    });

    expect(result.grant?.endsAt).toBe(state.oldGrantEndsAt);
    expect(result.grant?.status).toBe("active");
    expect(result.entitlement?.endsAt).toBe(state.oldGrantEndsAt);
    expect(result.entitlement?.sourceKind).toBe("competition");
  });

  it("deletes duplicate grant entitlements while keeping one canonical row", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "sync-deduplicate-grant-entitlements",
      });
      const endsAt = NOW + 24 * 60 * 60 * 1000;
      const campaignId = await insertTryoutAccessCampaign(ctx, {
        slug: "sync-deduplicate-grant-entitlements",
        name: "Sync Deduplicate Grant Entitlements",
        targetProducts: ["snbt"],
        campaignKind: "access-pass",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: NOW - 60 * 1000,
        endsAt: NOW + 7 * 24 * 60 * 60 * 1000,
        grantDurationDays: 7,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "sync-deduplicate-grant-entitlements",
        label: "Sync Deduplicate Grant Entitlements",
        enabled: true,
      });
      const grantId = await ctx.db.insert("tryoutAccessGrants", {
        campaignId,
        linkId,
        userId: identity.userId,
        redeemedAt: NOW,
        endsAt,
        status: "active",
      });

      await ctx.db.insert("userTryoutEntitlements", {
        userId: identity.userId,
        product: "snbt",
        sourceKind: "access-pass",
        accessCampaignId: campaignId,
        accessGrantId: grantId,
        startsAt: NOW - 1000,
        endsAt,
      });
      await ctx.db.insert("userTryoutEntitlements", {
        userId: identity.userId,
        product: "snbt",
        sourceKind: "access-pass",
        accessCampaignId: campaignId,
        accessGrantId: grantId,
        startsAt: NOW - 2000,
        endsAt,
      });

      return {
        campaignId,
        grantId,
        userId: identity.userId,
      };
    });

    await t.mutation(async (ctx) => {
      const grant = await ctx.db.get("tryoutAccessGrants", state.grantId);

      if (!grant) {
        throw new Error("expected grant to exist");
      }

      await syncTryoutAccessGrantStatus(ctx.db, grant, NOW);
    });

    const entitlements = await t.query(async (ctx) => {
      return await ctx.db
        .query("userTryoutEntitlements")
        .withIndex("by_accessGrantId", (q) =>
          q.eq("accessGrantId", state.grantId)
        )
        .collect();
    });

    expect(entitlements).toEqual([
      expect.objectContaining({
        accessCampaignId: state.campaignId,
        accessGrantId: state.grantId,
        product: "snbt",
        sourceKind: "access-pass",
        userId: state.userId,
      }),
    ]);
  });

  it("finalizes overdue pending competition batches in bounded sweep passes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const t = createTryoutTestConvex();

    await t.mutation(async (ctx) => {
      for (let index = 0; index <= 100; index += 1) {
        await insertTryoutAccessCampaign(ctx, {
          slug: `pending-competition-${index}`,
          name: `Pending Competition ${index}`,
          targetProducts: ["snbt"],
          campaignKind: "competition",
          enabled: true,
          redeemStatus: "ended",
          resultsStatus: "pending",
          resultsFinalizedAt: null,
          startsAt: NOW - 24 * 60 * 60 * 1000,
          endsAt: NOW - 1,
        });
      }
    });

    await t.mutation(
      internal.tryoutAccess.mutations.internal.status.sweepStates,
      {}
    );

    const intermediate = await t.query(async (ctx) => {
      const pendingCount = (
        await ctx.db
          .query("tryoutAccessCampaigns")
          .withIndex("by_campaignKind_and_resultsStatus_and_endsAt", (q) =>
            q.eq("campaignKind", "competition").eq("resultsStatus", "pending")
          )
          .take(102)
      ).length;
      const finalizedCount = (
        await ctx.db
          .query("tryoutAccessCampaigns")
          .withIndex("by_campaignKind_and_resultsStatus_and_endsAt", (q) =>
            q.eq("campaignKind", "competition").eq("resultsStatus", "finalized")
          )
          .take(102)
      ).length;

      return {
        finalizedCount,
        pendingCount,
      };
    });

    expect(intermediate).toEqual({
      finalizedCount: 100,
      pendingCount: 1,
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const finalizedCount = await t.query(async (ctx) => {
      return (
        await ctx.db
          .query("tryoutAccessCampaigns")
          .withIndex("by_campaignKind_and_resultsStatus_and_endsAt", (q) =>
            q.eq("campaignKind", "competition").eq("resultsStatus", "finalized")
          )
          .take(102)
      ).length;
    });

    expect(finalizedCount).toBe(101);

    vi.useRealTimers();
  });
});

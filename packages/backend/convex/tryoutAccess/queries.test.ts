import { api } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import { syncTryoutAccessGrantStatus } from "@repo/backend/convex/tryoutAccess/helpers/access";
import { insertTryoutAccessCampaign } from "@repo/backend/convex/tryoutAccess/test.helpers";
import {
  createTryoutTestConvex,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryoutAccess/queries", () => {
  it("returns active when the grant still has an active entitlement", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "event-page-active",
      });
      const endsAt = NOW + 24 * 60 * 60 * 1000;
      const campaignId = await insertTryoutAccessCampaign(ctx, {
        slug: "event-page-active",
        name: "Event Page Active",
        targetProducts: ["snbt"],
        campaignKind: "access-pass",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: NOW - 24 * 60 * 60 * 1000,
        endsAt: NOW + 7 * 24 * 60 * 60 * 1000,
        grantDurationDays: 7,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "event-page-active",
        label: "Event Page Active",
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

      await syncTryoutAccessGrantStatus(
        ctx.db,
        {
          _id: grantId,
          campaignId,
          endsAt,
          redeemedAt: NOW,
          status: "active",
          userId: identity.userId,
        },
        NOW
      );

      return {
        ...identity,
        endsAt,
      };
    });

    const result = await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .query(api.tryoutAccess.queries.getEventPageState, {
        code: "event-page-active",
      });

    expect(result).toEqual({
      kind: "active",
      endsAt: state.endsAt,
      name: "Event Page Active",
    });
  });

  it("returns used when the user already redeemed the campaign but has no active entitlement", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "event-page-used",
      });
      const endsAt = NOW - 24 * 60 * 60 * 1000;
      const campaignId = await insertTryoutAccessCampaign(ctx, {
        slug: "event-page-used",
        name: "Event Page Used",
        targetProducts: ["snbt"],
        campaignKind: "access-pass",
        enabled: true,
        redeemStatus: "ended",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: NOW - 7 * 24 * 60 * 60 * 1000,
        endsAt: NOW - 2 * 24 * 60 * 60 * 1000,
        grantDurationDays: 7,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "event-page-used",
        label: "Event Page Used",
        enabled: true,
      });
      const grantId = await ctx.db.insert("tryoutAccessGrants", {
        campaignId,
        linkId,
        userId: identity.userId,
        redeemedAt: NOW - 3 * 24 * 60 * 60 * 1000,
        endsAt,
        status: "expired",
      });

      await syncTryoutAccessGrantStatus(
        ctx.db,
        {
          _id: grantId,
          campaignId,
          endsAt,
          redeemedAt: NOW - 3 * 24 * 60 * 60 * 1000,
          status: "expired",
          userId: identity.userId,
        },
        NOW
      );

      return {
        ...identity,
        endsAt,
      };
    });

    const result = await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .query(api.tryoutAccess.queries.getEventPageState, {
        code: "event-page-used",
      });

    expect(result).toEqual({
      kind: "used",
      endsAt: state.endsAt,
      name: "Event Page Used",
    });
  });

  it("returns ready for an authenticated user before redeeming", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "event-page-ready",
      });

      await insertTryoutAccessCampaign(ctx, {
        slug: "event-page-ready",
        name: "Event Page Ready",
        targetProducts: ["snbt"],
        campaignKind: "competition",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: NOW - 60 * 1000,
        endsAt: NOW + 24 * 60 * 60 * 1000,
      });
      const campaign = await ctx.db
        .query("tryoutAccessCampaigns")
        .withIndex("by_slug", (q) => q.eq("slug", "event-page-ready"))
        .unique();

      if (!campaign) {
        throw new Error("expected campaign to exist");
      }

      await ctx.db.insert("tryoutAccessLinks", {
        campaignId: campaign._id,
        code: "event-page-ready",
        label: "Event Page Ready",
        enabled: true,
      });

      return identity;
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.tryoutAccess.queries.getEventPageState, {
        code: "event-page-ready",
      });

    expect(result).toEqual({
      kind: "ready",
      name: "Event Page Ready",
    });
  });
});

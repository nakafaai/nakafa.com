import { api } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  createTryoutTestConvex,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryoutAccess/queries", () => {
  it("returns active for a competition grant when ops extends the campaign window", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "event-page-competition-extended",
      });
      const staleEndsAt = NOW - 24 * 60 * 60 * 1000;
      const extendedEndsAt = NOW + 24 * 60 * 60 * 1000;
      const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "event-page-competition-extended",
        name: "Event Page Competition Extended",
        products: ["snbt"],
        campaignKind: "competition",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: NOW - 7 * 24 * 60 * 60 * 1000,
        endsAt: extendedEndsAt,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "event-page-competition-extended",
        label: "Event Page Competition Extended",
        enabled: true,
      });

      await ctx.db.insert("tryoutAccessGrants", {
        campaignId,
        linkId,
        userId: identity.userId,
        redeemedAt: NOW - 3 * 24 * 60 * 60 * 1000,
        endsAt: staleEndsAt,
        status: "expired",
      });

      return {
        ...identity,
        extendedEndsAt,
      };
    });

    const result = await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .query(api.tryoutAccess.queries.getEventPageState, {
        code: "event-page-competition-extended",
      });

    expect(result).toEqual({
      kind: "active",
      endsAt: state.extendedEndsAt,
      name: "Event Page Competition Extended",
    });
  });

  it("returns active when the stored grant is still active", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "event-page-active",
      });
      const endsAt = NOW + 24 * 60 * 60 * 1000;
      const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "event-page-active",
        name: "Event Page Active",
        products: ["snbt"],
        campaignKind: "access-pass",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: NOW - 24 * 60 * 60 * 1000,
        endsAt: NOW + 7 * 24 * 60 * 60 * 1000,
        grantDurationDays: 30,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "event-page-active",
        label: "Event Page Active",
        enabled: true,
      });

      await ctx.db.insert("tryoutAccessGrants", {
        campaignId,
        linkId,
        userId: identity.userId,
        redeemedAt: NOW,
        endsAt,
        status: "active",
      });

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

  it("returns used when the stored grant is already expired", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "event-page-used",
      });
      const endsAt = NOW - 24 * 60 * 60 * 1000;
      const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "event-page-used",
        name: "Event Page Used",
        products: ["snbt"],
        campaignKind: "access-pass",
        enabled: true,
        redeemStatus: "ended",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: NOW - 7 * 24 * 60 * 60 * 1000,
        endsAt: NOW - 2 * 24 * 60 * 60 * 1000,
        grantDurationDays: 30,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "event-page-used",
        label: "Event Page Used",
        enabled: true,
      });

      await ctx.db.insert("tryoutAccessGrants", {
        campaignId,
        linkId,
        userId: identity.userId,
        redeemedAt: NOW - 3 * 24 * 60 * 60 * 1000,
        endsAt,
        status: "expired",
      });

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
});

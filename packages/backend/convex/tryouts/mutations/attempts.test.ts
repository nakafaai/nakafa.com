import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  syncTryoutAccessGrantStatus,
  syncTryoutSubscriptionEntitlements,
} from "@repo/backend/convex/tryoutAccess/helpers/access";
import {
  ATTEMPT_WINDOW_MS,
  createTryoutTestConvex,
  insertExerciseQuestion,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { products } from "@repo/backend/convex/utils/polar/products";
import { describe, expect, it } from "vitest";

async function insertActiveProSubscription(
  ctx: MutationCtx,
  userId: Id<"users">
) {
  await ctx.db.insert("customers", {
    id: `customer-${userId}`,
    externalId: null,
    metadata: {},
    userId,
  });
  const subscriptionId = await ctx.db.insert("subscriptions", {
    id: `subscription-${userId}`,
    customerId: `customer-${userId}`,
    createdAt: new Date(NOW).toISOString(),
    modifiedAt: null,
    amount: null,
    currency: null,
    recurringInterval: null,
    status: "active",
    currentPeriodStart: new Date(NOW).toISOString(),
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    startedAt: new Date(NOW).toISOString(),
    endedAt: null,
    productId: products.pro.id,
    checkoutId: null,
    metadata: {},
  });

  await syncTryoutSubscriptionEntitlements(ctx.db, {
    activeSubscriptions: [
      {
        _id: subscriptionId,
        currentPeriodEnd: null,
        currentPeriodStart: new Date(NOW).toISOString(),
        productId: products.pro.id,
      },
    ],
    userId,
  });
}

async function insertTryoutAccessGrant(
  ctx: MutationCtx,
  {
    campaignId,
    endsAt,
    linkId,
    status,
    syncedAt,
    userId,
  }: {
    campaignId: Id<"tryoutAccessCampaigns">;
    endsAt: number;
    linkId: Id<"tryoutAccessLinks">;
    status: "active" | "expired";
    syncedAt: number;
    userId: Id<"users">;
  }
) {
  const grantId = await ctx.db.insert("tryoutAccessGrants", {
    campaignId,
    linkId,
    userId,
    redeemedAt: NOW,
    endsAt,
    status,
  });

  await syncTryoutAccessGrantStatus(
    ctx.db,
    {
      _id: grantId,
      campaignId,
      endsAt,
      redeemedAt: NOW,
      status,
      userId,
    },
    syncedAt
  );

  return grantId;
}

describe("tryouts/mutations/attempts", () => {
  it("starts new tryout attempts without persisting a legacy irtScore field", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "start-reporting",
      });
      const tryout = await insertTryoutSkeleton(ctx, "2026-reporting-start");

      await insertActiveProSubscription(ctx, identity.userId);

      return {
        ...identity,
        tryoutId: tryout.tryoutId,
      };
    });

    await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.tryouts.mutations.attempts.startTryout, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "2026-reporting-start",
      });

    const tryoutAttempt = await t.query(async (ctx) => {
      return await ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
          q.eq("userId", identity.userId).eq("tryoutId", identity.tryoutId)
        )
        .order("desc")
        .first();
    });

    expect(tryoutAttempt).not.toBeNull();
    expect(tryoutAttempt?.theta).toBe(0);

    if (!tryoutAttempt) {
      return;
    }

    expect("irtScore" in tryoutAttempt).toBe(false);
    expect(tryoutAttempt.accessKind).toBe("subscription");
    expect(tryoutAttempt.countsForCompetition).toBe(false);
    expect(tryoutAttempt.partSetSnapshots).toEqual([
      {
        partIndex: 0,
        partKey: "quantitative-knowledge",
        questionCount: 20,
        setId: expect.any(String),
      },
    ]);
  });

  it("uses competition event access for the first attempt and clamps expiry to the event end", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const currentTime = Date.now();
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "competition-first-attempt",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "competition-first-attempt"
      );
      const endsAt = currentTime + 6 * 60 * 60 * 1000;
      const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "competition-first-attempt",
        name: "Competition First Attempt",
        products: ["snbt"],
        campaignKind: "competition",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: currentTime - 60 * 1000,
        endsAt,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "competition-first-attempt",
        label: "Competition First Attempt",
        enabled: true,
      });
      const grantId = await insertTryoutAccessGrant(ctx, {
        campaignId,
        endsAt,
        linkId,
        status: "active",
        syncedAt: currentTime,
        userId: identity.userId,
      });

      return {
        ...identity,
        campaignId,
        endsAt,
        grantId,
        tryoutId: tryout.tryoutId,
      };
    });

    await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .mutation(api.tryouts.mutations.attempts.startTryout, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "competition-first-attempt",
      });

    const tryoutAttempt = await t.query(async (ctx) => {
      return await ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
          q.eq("userId", state.userId).eq("tryoutId", state.tryoutId)
        )
        .order("desc")
        .first();
    });

    expect(tryoutAttempt?.accessKind).toBe("event");
    expect(tryoutAttempt?.accessCampaignId).toBe(state.campaignId);
    expect(tryoutAttempt?.accessCampaignKind).toBe("competition");
    expect(tryoutAttempt?.accessGrantId).toBe(state.grantId);
    expect(tryoutAttempt?.accessEndsAt).toBe(state.endsAt);
    expect(tryoutAttempt?.countsForCompetition).toBe(true);
    expect(tryoutAttempt?.expiresAt).toBe(state.endsAt);
  });

  it("falls back to Pro access after the counted competition attempt already exists", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const currentTime = Date.now();
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "competition-then-pro",
      });
      const tryout = await insertTryoutSkeleton(ctx, "competition-then-pro");
      const endsAt = currentTime + 6 * 60 * 60 * 1000;
      const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "competition-then-pro",
        name: "Competition Then Pro",
        products: ["snbt"],
        campaignKind: "competition",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: currentTime - 60 * 1000,
        endsAt,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "competition-then-pro",
        label: "Competition Then Pro",
        enabled: true,
      });
      const grantId = await insertTryoutAccessGrant(ctx, {
        campaignId,
        endsAt,
        linkId,
        status: "active",
        syncedAt: currentTime,
        userId: identity.userId,
      });
      await insertActiveProSubscription(ctx, identity.userId);
      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        accessKind: "event",
        accessCampaignId: campaignId,
        accessCampaignKind: "competition",
        accessGrantId: grantId,
        accessEndsAt: endsAt,
        countsForCompetition: true,
        scoreStatus: "official",
        status: "completed",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 20,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [0],
        totalCorrect: 0,
        totalQuestions: 20,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: endsAt,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "submitted",
      });
      await ctx.db.insert("userTryoutCompetitionClaims", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        accessCampaignId: campaignId,
        tryoutAttemptId,
        claimedAt: NOW,
      });

      return {
        ...identity,
        tryoutId: tryout.tryoutId,
      };
    });

    await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .mutation(api.tryouts.mutations.attempts.startTryout, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "competition-then-pro",
      });

    const latestAttempt = await t.query(async (ctx) => {
      return await ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
          q.eq("userId", state.userId).eq("tryoutId", state.tryoutId)
        )
        .order("desc")
        .first();
    });

    expect(latestAttempt?.accessKind).toBe("subscription");
    expect(latestAttempt?.accessCampaignId).toBeUndefined();
    expect(latestAttempt?.countsForCompetition).toBe(false);
  });

  it("rejects another competition attempt when no non-event access remains", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const currentTime = Date.now();
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "competition-attempt-used",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "competition-attempt-used"
      );
      const endsAt = currentTime + 6 * 60 * 60 * 1000;
      const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "competition-attempt-used",
        name: "Competition Attempt Used",
        products: ["snbt"],
        campaignKind: "competition",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: currentTime - 60 * 1000,
        endsAt,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "competition-attempt-used",
        label: "Competition Attempt Used",
        enabled: true,
      });
      const grantId = await insertTryoutAccessGrant(ctx, {
        campaignId,
        endsAt,
        linkId,
        status: "active",
        syncedAt: currentTime,
        userId: identity.userId,
      });
      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        accessKind: "event",
        accessCampaignId: campaignId,
        accessCampaignKind: "competition",
        accessGrantId: grantId,
        accessEndsAt: endsAt,
        countsForCompetition: true,
        scoreStatus: "official",
        status: "completed",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 20,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [0],
        totalCorrect: 0,
        totalQuestions: 20,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: endsAt,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "submitted",
      });
      await ctx.db.insert("userTryoutCompetitionClaims", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        accessCampaignId: campaignId,
        tryoutAttemptId,
        claimedAt: NOW,
      });

      return identity;
    });

    await expect(
      t
        .withIdentity({
          subject: state.authUserId,
          sessionId: state.sessionId,
        })
        .mutation(api.tryouts.mutations.attempts.startTryout, {
          product: "snbt",
          locale: "id",
          tryoutSlug: "competition-attempt-used",
        })
    ).rejects.toThrow("This event only counts your first tryout attempt.");
  });

  it("returns access required after the counted competition campaign has ended", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const currentTime = Date.now();
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "ended-competition-attempt",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "ended-competition-attempt"
      );
      const endedAt = currentTime - 60 * 1000;
      const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "ended-competition-attempt",
        name: "Ended Competition Attempt",
        products: ["snbt"],
        campaignKind: "competition",
        enabled: true,
        redeemStatus: "ended",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: currentTime - 2 * 60 * 60 * 1000,
        endsAt: endedAt,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "ended-competition-attempt",
        label: "Ended Competition Attempt",
        enabled: true,
      });
      const grantId = await insertTryoutAccessGrant(ctx, {
        campaignId,
        endsAt: endedAt,
        linkId,
        status: "expired",
        syncedAt: currentTime,
        userId: identity.userId,
      });
      await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        accessKind: "event",
        accessCampaignId: campaignId,
        accessCampaignKind: "competition",
        accessGrantId: grantId,
        accessEndsAt: endedAt,
        countsForCompetition: true,
        scoreStatus: "official",
        status: "completed",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 20,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [0],
        totalCorrect: 0,
        totalQuestions: 20,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: endedAt,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "submitted",
      });

      return identity;
    });

    await expect(
      t
        .withIdentity({
          subject: state.authUserId,
          sessionId: state.sessionId,
        })
        .mutation(api.tryouts.mutations.attempts.startTryout, {
          product: "snbt",
          locale: "id",
          tryoutSlug: "ended-competition-attempt",
        })
    ).rejects.toThrow(
      "You need an active event access or Pro subscription to start this tryout."
    );
  });

  it("uses the longest active access-pass window without shortening the tryout expiry", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const currentTime = Date.now();
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "longest-access-pass-window",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "longest-access-pass-window"
      );
      const shorterEndsAt = currentTime + 30 * 60 * 1000;
      const longerEndsAt = currentTime + 60 * 60 * 1000;
      const shorterCampaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "shorter-access-pass-window",
        name: "Shorter Access Pass",
        products: ["snbt"],
        campaignKind: "access-pass",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: currentTime - 60 * 1000,
        endsAt: currentTime + 24 * 60 * 60 * 1000,
        grantDurationDays: 30,
      });
      const longerCampaignId = await ctx.db.insert("tryoutAccessCampaigns", {
        slug: "longer-access-pass-window",
        name: "Longer Access Pass",
        products: ["snbt"],
        campaignKind: "access-pass",
        enabled: true,
        redeemStatus: "active",
        resultsStatus: "pending",
        resultsFinalizedAt: null,
        startsAt: currentTime - 60 * 1000,
        endsAt: currentTime + 24 * 60 * 60 * 1000,
        grantDurationDays: 30,
      });
      const shorterLinkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId: shorterCampaignId,
        code: "shorter-access-pass-window",
        label: "Shorter Access Pass",
        enabled: true,
      });
      const longerLinkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId: longerCampaignId,
        code: "longer-access-pass-window",
        label: "Longer Access Pass",
        enabled: true,
      });
      await insertTryoutAccessGrant(ctx, {
        campaignId: shorterCampaignId,
        endsAt: shorterEndsAt,
        linkId: shorterLinkId,
        status: "active",
        syncedAt: currentTime,
        userId: identity.userId,
      });
      const longerGrantId = await insertTryoutAccessGrant(ctx, {
        campaignId: longerCampaignId,
        endsAt: longerEndsAt,
        linkId: longerLinkId,
        status: "active",
        syncedAt: currentTime,
        userId: identity.userId,
      });

      return {
        ...identity,
        earliestAttemptExpiresAt: currentTime + ATTEMPT_WINDOW_MS,
        longerCampaignId,
        longerEndsAt,
        longerGrantId,
        tryoutId: tryout.tryoutId,
      };
    });

    await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .mutation(api.tryouts.mutations.attempts.startTryout, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "longest-access-pass-window",
      });

    const tryoutAttempt = await t.query(async (ctx) => {
      return await ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
          q.eq("userId", state.userId).eq("tryoutId", state.tryoutId)
        )
        .order("desc")
        .first();
    });

    expect(tryoutAttempt?.accessCampaignId).toBe(state.longerCampaignId);
    expect(tryoutAttempt?.accessGrantId).toBe(state.longerGrantId);
    expect(tryoutAttempt?.accessEndsAt).toBe(state.longerEndsAt);
    expect(tryoutAttempt?.expiresAt).toBeGreaterThanOrEqual(
      state.earliestAttemptExpiresAt
    );
    expect(tryoutAttempt?.expiresAt).toBeLessThan(
      state.earliestAttemptExpiresAt + 5000
    );
  });

  it("pages through many active access-pass grants instead of blocking access", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const currentTime = Date.now();
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "many-access-pass-grants",
      });
      const tryout = await insertTryoutSkeleton(ctx, "many-access-pass-grants");
      let longestCampaignId = "" as Id<"tryoutAccessCampaigns">;
      let longestGrantId = "" as Id<"tryoutAccessGrants">;
      let longestEndsAt = currentTime;

      for (let index = 0; index < 55; index += 1) {
        const endsAt = currentTime + (index + 1) * 60 * 1000;
        const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
          slug: `many-access-pass-grants-${index}`,
          name: `Many Access Pass ${index}`,
          products: ["snbt"],
          campaignKind: "access-pass",
          enabled: true,
          redeemStatus: "active",
          resultsStatus: "pending",
          resultsFinalizedAt: null,
          startsAt: currentTime - 60 * 1000,
          endsAt: currentTime + 24 * 60 * 60 * 1000,
          grantDurationDays: 30,
        });
        const linkId = await ctx.db.insert("tryoutAccessLinks", {
          campaignId,
          code: `many-access-pass-grants-${index}`,
          label: `Many Access Pass ${index}`,
          enabled: true,
        });
        const grantId = await insertTryoutAccessGrant(ctx, {
          campaignId,
          endsAt,
          linkId,
          status: "active",
          syncedAt: currentTime,
          userId: identity.userId,
        });

        longestCampaignId = campaignId;
        longestGrantId = grantId;
        longestEndsAt = endsAt;
      }

      return {
        ...identity,
        longestCampaignId,
        longestEndsAt,
        longestGrantId,
        tryoutId: tryout.tryoutId,
      };
    });

    await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .mutation(api.tryouts.mutations.attempts.startTryout, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "many-access-pass-grants",
      });

    const tryoutAttempt = await t.query(async (ctx) => {
      return await ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
          q.eq("userId", state.userId).eq("tryoutId", state.tryoutId)
        )
        .order("desc")
        .first();
    });

    expect(tryoutAttempt?.accessCampaignId).toBe(state.longestCampaignId);
    expect(tryoutAttempt?.accessGrantId).toBe(state.longestGrantId);
    expect(tryoutAttempt?.accessEndsAt).toBe(state.longestEndsAt);
  });

  it("starts an unstarted part from the persisted snapshot after live key, set, and count changes", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "start-renamed-part",
      });
      const tryout = await insertTryoutSkeleton(ctx, "start-renamed-part");
      const replacementSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/start-renamed-part-mr",
        category: "high-school",
        type: "snbt",
        material: "mathematical-reasoning",
        exerciseType: "try-out",
        setName: "start-renamed-part-mr",
        title: "Mathematical Reasoning",
        questionCount: 15,
        syncedAt: NOW,
      });
      const tryoutPartSet = await ctx.db
        .query("tryoutPartSets")
        .withIndex("by_tryoutId_and_partIndex", (q) =>
          q.eq("tryoutId", tryout.tryoutId)
        )
        .unique();

      if (!tryoutPartSet) {
        throw new Error("Expected tryout part set to exist");
      }

      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        scoreStatus: "official",
        status: "in-progress",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 20,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [],
        totalCorrect: 0,
        totalQuestions: 0,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + ATTEMPT_WINDOW_MS,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
      });

      await ctx.db.patch("tryoutPartSets", tryoutPartSet._id, {
        partKey: "mathematical-reasoning",
        setId: replacementSetId,
      });
      await ctx.db.patch("exerciseSets", tryout.setId, {
        questionCount: 30,
      });

      return {
        ...identity,
        originalSetId: tryout.setId,
        tryoutAttemptId,
      };
    });

    await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .mutation(api.tryouts.mutations.attempts.startPart, {
        partKey: "mathematical-reasoning",
        tryoutAttemptId: state.tryoutAttemptId,
      });

    const result = await t.query(async (ctx) => {
      const partAttempt = await ctx.db
        .query("tryoutPartAttempts")
        .withIndex("by_tryoutAttemptId_and_partIndex", (q) =>
          q.eq("tryoutAttemptId", state.tryoutAttemptId).eq("partIndex", 0)
        )
        .unique();

      if (!partAttempt) {
        return null;
      }

      return {
        partAttempt,
        setAttempt: await ctx.db.get(
          "exerciseAttempts",
          partAttempt.setAttemptId
        ),
      };
    });

    expect(result?.partAttempt.partKey).toBe("quantitative-knowledge");
    expect(result?.partAttempt.setId).toBe(state.originalSetId);
    expect(result?.setAttempt?.totalExercises).toBe(20);
    expect(result?.setAttempt?.timeLimit).toBe(20 * 90);
  });

  it("reuses an already started part after the current route key changes", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const currentTime = Date.now();
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "reuse-renamed-part",
      });
      const tryout = await insertTryoutSkeleton(ctx, "reuse-renamed-part", 1);
      const questionId = await insertExerciseQuestion(ctx, tryout.setId, {
        slug: "reuse-renamed-part",
      });
      const tryoutPartSet = await ctx.db
        .query("tryoutPartSets")
        .withIndex("by_tryoutId_and_partIndex", (q) =>
          q.eq("tryoutId", tryout.tryoutId)
        )
        .unique();

      if (!tryoutPartSet) {
        throw new Error("Expected tryout part set to exist");
      }

      const setAttemptId = await ctx.db.insert("exerciseAttempts", {
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/reuse-renamed-part",
        userId: identity.userId,
        origin: "tryout",
        mode: "simulation",
        scope: "set",
        timeLimit: 24 * 60 * 60,
        startedAt: currentTime,
        lastActivityAt: currentTime,
        completedAt: null,
        endReason: null,
        status: "in-progress",
        updatedAt: currentTime,
        totalExercises: 1,
        answeredCount: 0,
        correctAnswers: 0,
        totalTime: 0,
        scorePercentage: 0,
      });
      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        scoreStatus: "official",
        status: "in-progress",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 1,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [],
        totalCorrect: 0,
        totalQuestions: 0,
        theta: 0,
        thetaSE: 1,
        startedAt: currentTime,
        expiresAt: currentTime + ATTEMPT_WINDOW_MS,
        lastActivityAt: currentTime,
        completedAt: null,
        endReason: null,
      });

      await ctx.db.insert("exerciseAnswers", {
        attemptId: setAttemptId,
        exerciseNumber: 1,
        questionId,
        isCorrect: false,
        timeSpent: 30,
        answeredAt: currentTime,
        updatedAt: currentTime,
      });
      await ctx.db.insert("tryoutPartAttempts", {
        tryoutAttemptId,
        partIndex: 0,
        partKey: "quantitative-knowledge",
        setAttemptId,
        setId: tryout.setId,
        theta: 0,
        thetaSE: 1,
      });
      await ctx.db.patch("tryoutPartSets", tryoutPartSet._id, {
        partKey: "mathematical-reasoning",
      });

      return {
        ...identity,
        setAttemptId,
        tryoutAttemptId,
      };
    });

    await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .mutation(api.tryouts.mutations.attempts.startPart, {
        partKey: "mathematical-reasoning",
        tryoutAttemptId: state.tryoutAttemptId,
      });

    const result = await t.query(async (ctx) => {
      return await ctx.db
        .query("tryoutPartAttempts")
        .withIndex("by_tryoutAttemptId_and_partIndex", (q) =>
          q.eq("tryoutAttemptId", state.tryoutAttemptId).eq("partIndex", 0)
        )
        .take(2);
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.setAttemptId).toBe(state.setAttemptId);
  });

  it("completes a renamed part by its stable part index", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "complete-renamed-part",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "complete-renamed-part",
        1
      );
      await ctx.db.patch("irtScaleVersions", tryout.scaleVersionId, {
        status: "provisional",
      });
      const questionId = await insertExerciseQuestion(ctx, tryout.setId, {
        slug: "complete-renamed-part",
      });
      const tryoutPartSet = await ctx.db
        .query("tryoutPartSets")
        .withIndex("by_tryoutId_and_partIndex", (q) =>
          q.eq("tryoutId", tryout.tryoutId)
        )
        .unique();

      if (!tryoutPartSet) {
        throw new Error("Expected tryout part set to exist");
      }

      await ctx.db.insert("irtScaleVersionItems", {
        scaleVersionId: tryout.scaleVersionId,
        calibrationRunId: await ctx.db.insert("irtCalibrationRuns", {
          setId: tryout.setId,
          model: "2pl",
          status: "completed",
          questionCount: 1,
          responseCount: 200,
          attemptCount: 200,
          iterationCount: 1,
          maxParameterDelta: 0.001,
          startedAt: NOW,
          updatedAt: NOW,
          completedAt: NOW,
        }),
        questionId,
        setId: tryout.setId,
        difficulty: 0,
        discrimination: 1,
      });

      const setAttemptId = await ctx.db.insert("exerciseAttempts", {
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/complete-renamed-part",
        userId: identity.userId,
        origin: "tryout",
        mode: "simulation",
        scope: "set",
        timeLimit: 90,
        startedAt: NOW,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
        status: "in-progress",
        updatedAt: NOW,
        totalExercises: 1,
        answeredCount: 1,
        correctAnswers: 1,
        totalTime: 0,
        scorePercentage: 100,
      });
      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        scoreStatus: "provisional",
        status: "in-progress",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 1,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [],
        totalCorrect: 0,
        totalQuestions: 0,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + ATTEMPT_WINDOW_MS,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
      });

      await ctx.db.insert("exerciseAnswers", {
        attemptId: setAttemptId,
        exerciseNumber: 1,
        questionId,
        isCorrect: true,
        timeSpent: 30,
        answeredAt: NOW,
        updatedAt: NOW,
      });
      await ctx.db.insert("tryoutPartAttempts", {
        tryoutAttemptId,
        partIndex: 0,
        partKey: "quantitative-knowledge",
        setAttemptId,
        setId: tryout.setId,
        theta: 0,
        thetaSE: 1,
      });
      await ctx.db.patch("tryoutPartSets", tryoutPartSet._id, {
        partKey: "mathematical-reasoning",
      });

      return {
        ...identity,
        tryoutAttemptId,
      };
    });

    await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .mutation(api.tryouts.mutations.attempts.completePart, {
        partKey: "mathematical-reasoning",
        tryoutAttemptId: state.tryoutAttemptId,
      });

    const result = await t.query(async (ctx) => {
      return await ctx.db.get("tryoutAttempts", state.tryoutAttemptId);
    });

    expect(result?.completedPartIndices).toEqual([0]);
  });

  it("reuses a partially completed attempt after live partCount shrinks", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "reuse-shrunk-partcount",
      });
      const tryout = await insertTryoutSkeleton(ctx, "reuse-shrunk-partcount");

      await ctx.db.patch("tryouts", tryout.tryoutId, {
        partCount: 2,
        totalQuestionCount: 40,
      });
      const secondSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/reuse-shrunk-partcount-mr",
        category: "high-school",
        type: "snbt",
        material: "mathematical-reasoning",
        exerciseType: "try-out",
        setName: "reuse-shrunk-partcount-mr",
        title: "Mathematical Reasoning",
        questionCount: 20,
        syncedAt: NOW,
      });

      await ctx.db.insert("tryoutPartSets", {
        tryoutId: tryout.tryoutId,
        setId: secondSetId,
        partIndex: 1,
        partKey: "mathematical-reasoning",
      });

      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        scoreStatus: "official",
        status: "in-progress",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 20,
            setId: tryout.setId,
          },
          {
            partIndex: 1,
            partKey: "mathematical-reasoning",
            questionCount: 20,
            setId: secondSetId,
          },
        ],
        completedPartIndices: [0],
        totalCorrect: 0,
        totalQuestions: 20,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + ATTEMPT_WINDOW_MS,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
      });

      await ctx.db.insert("userTryoutLatestAttempts", {
        userId: identity.userId,
        product: "snbt",
        locale: "id",
        tryoutId: tryout.tryoutId,
        attemptId: tryoutAttemptId,
        slug: "reuse-shrunk-partcount",
        status: "in-progress",
        expiresAtMs: NOW + ATTEMPT_WINDOW_MS,
        updatedAt: NOW,
      });
      await ctx.db.patch("tryouts", tryout.tryoutId, {
        partCount: 1,
        totalQuestionCount: 20,
      });

      return {
        ...identity,
        tryoutId: tryout.tryoutId,
      };
    });

    await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .mutation(api.tryouts.mutations.attempts.startTryout, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "reuse-shrunk-partcount",
      });

    const attempts = await t.query(async (ctx) => {
      return await ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
          q.eq("userId", state.userId).eq("tryoutId", state.tryoutId)
        )
        .collect();
    });

    expect(attempts).toHaveLength(1);
  });
});

import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import { upsertUserTryoutLatestAttempt } from "@repo/backend/convex/tryouts/helpers/latest";
import {
  createTryoutTestConvex,
  insertCompletedTryoutAttempt,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/helpers/latest", () => {
  it("writes the hub badge summary alongside the latest attempt projection", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "catalog-summary-write",
      });
      const tryout = await insertTryoutSkeleton(ctx, "catalog-summary-write");
      const completedAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "catalog-summary-write",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      await upsertUserTryoutLatestAttempt(ctx, {
        attempt: {
          _id: completedAttempt.tryoutAttemptId,
          expiresAt: NOW + 1234,
          status: "completed",
          tryoutId: tryout.tryoutId,
          userId: identity.userId,
        },
        tryout: {
          _id: tryout.tryoutId,
          locale: "id",
          product: "snbt",
          slug: "catalog-summary-write",
        },
        updatedAt: NOW + 1,
      });

      return identity;
    });

    const result = await t.query(async (ctx) => {
      return await ctx.db
        .query("userTryoutCatalogStatuses")
        .withIndex("by_userId_and_product_and_locale", (q) =>
          q.eq("userId", state.userId).eq("product", "snbt").eq("locale", "id")
        )
        .unique();
    });

    expect(result?.statusesBySlug["catalog-summary-write"]).toEqual({
      expiresAtMs: NOW + 1234,
      status: "completed",
      updatedAt: NOW + 1,
    });
  });

  it("keeps the newer hub badge summary when an older update arrives later", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "catalog-summary-stale",
      });
      const tryout = await insertTryoutSkeleton(ctx, "catalog-summary-stale");
      const completedAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "catalog-summary-stale",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      await upsertUserTryoutLatestAttempt(ctx, {
        attempt: {
          _id: completedAttempt.tryoutAttemptId,
          expiresAt: NOW + 5000,
          status: "completed",
          tryoutId: tryout.tryoutId,
          userId: identity.userId,
        },
        tryout: {
          _id: tryout.tryoutId,
          locale: "id",
          product: "snbt",
          slug: "catalog-summary-stale",
        },
        updatedAt: NOW + 10,
      });
      await upsertUserTryoutLatestAttempt(ctx, {
        attempt: {
          _id: completedAttempt.tryoutAttemptId,
          expiresAt: NOW + 100,
          status: "expired",
          tryoutId: tryout.tryoutId,
          userId: identity.userId,
        },
        tryout: {
          _id: tryout.tryoutId,
          locale: "id",
          product: "snbt",
          slug: "catalog-summary-stale",
        },
        updatedAt: NOW + 1,
      });

      return identity;
    });

    const result = await t.query(async (ctx) => {
      return await ctx.db
        .query("userTryoutCatalogStatuses")
        .withIndex("by_userId_and_product_and_locale", (q) =>
          q.eq("userId", state.userId).eq("product", "snbt").eq("locale", "id")
        )
        .unique();
    });

    expect(result?.statusesBySlug["catalog-summary-stale"]).toEqual({
      expiresAtMs: NOW + 5000,
      status: "completed",
      updatedAt: NOW + 10,
    });
  });
});

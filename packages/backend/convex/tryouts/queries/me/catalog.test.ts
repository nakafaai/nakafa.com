import { api } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  ATTEMPT_WINDOW_MS,
  createTryoutTestConvex,
  insertCompletedTryoutAttempt,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/queries/me/catalog", () => {
  it("returns the authenticated user's hub badge summary", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "catalog-status-query",
      });
      const tryout = await insertTryoutSkeleton(ctx, "catalog-status-query");
      const completedAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "catalog-status-query",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });
      const latestAttempt = await ctx.db
        .query("userTryoutLatestAttempts")
        .withIndex("by_userId_and_product_and_locale_and_tryoutId", (q) =>
          q
            .eq("userId", identity.userId)
            .eq("product", "snbt")
            .eq("locale", "id")
            .eq("tryoutId", tryout.tryoutId)
        )
        .unique();

      if (!latestAttempt) {
        throw new Error("Latest tryout attempt projection is required.");
      }

      await ctx.db.patch("userTryoutLatestAttempts", latestAttempt._id, {
        attemptId: completedAttempt.tryoutAttemptId,
        expiresAtMs: NOW + 1000,
        status: "in-progress",
        updatedAt: NOW,
      });

      return {
        ...identity,
        tryoutId: tryout.tryoutId,
      };
    });

    const result = await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .query(api.tryouts.queries.me.catalog.getMyTryoutCatalogStatuses, {
        locale: "id",
        product: "snbt",
        tryoutIds: [state.tryoutId],
      });

    expect(result.statusesBySlug["catalog-status-query"]).toEqual({
      expiresAtMs: NOW + 1000,
      status: "in-progress",
      updatedAt: NOW,
    });
  });

  it("returns statuses for the requested tryout ids from the latest projection", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "catalog-status-latest-projection",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "catalog-status-latest-projection"
      );

      await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "catalog-status-latest-projection",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      return {
        ...identity,
        tryoutId: tryout.tryoutId,
      };
    });

    const result = await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .query(api.tryouts.queries.me.catalog.getMyTryoutCatalogStatuses, {
        locale: "id",
        product: "snbt",
        tryoutIds: [state.tryoutId],
      });

    expect(result.statusesBySlug["catalog-status-latest-projection"]).toEqual({
      expiresAtMs: NOW + ATTEMPT_WINDOW_MS,
      status: "completed",
      updatedAt: NOW,
    });
  });
});

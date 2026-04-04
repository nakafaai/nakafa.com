import { api, internal } from "@repo/backend/convex/_generated/api";
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

      await ctx.db.insert("userTryoutCatalogStatuses", {
        locale: "id",
        product: "snbt",
        statusesBySlug: {
          "catalog-status-query": {
            expiresAtMs: NOW + 1000,
            status: "in-progress",
            updatedAt: NOW,
          },
        },
        updatedAt: NOW,
        userId: identity.userId,
      });

      return identity;
    });

    const result = await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .query(api.tryouts.queries.me.catalog.getMyTryoutCatalogStatuses, {
        locale: "id",
        product: "snbt",
      });

    expect(result.statusesBySlug["catalog-status-query"]).toEqual({
      expiresAtMs: NOW + 1000,
      status: "in-progress",
      updatedAt: NOW,
    });
  });

  it("backfills missing hub badge summaries from the latest attempt projection", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "catalog-status-backfill",
      });
      const tryout = await insertTryoutSkeleton(ctx, "catalog-status-backfill");

      await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "catalog-status-backfill",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      return identity;
    });

    await t.mutation(
      internal.tryouts.mutations.internal.catalog
        .backfillUserTryoutCatalogStatuses,
      {}
    );

    const result = await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .query(api.tryouts.queries.me.catalog.getMyTryoutCatalogStatuses, {
        locale: "id",
        product: "snbt",
      });

    expect(result.statusesBySlug["catalog-status-backfill"]).toEqual({
      expiresAtMs: NOW + ATTEMPT_WINDOW_MS,
      status: "completed",
      updatedAt: NOW,
    });
  });
});

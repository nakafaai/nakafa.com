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

describe("tryouts/queries/tryouts", () => {
  it("returns the active count and first catalog page in one snapshot query", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "catalog-snapshot",
      });

      const tryout = await insertTryoutSkeleton(ctx, "2026-set-a");

      await ctx.db.patch("tryouts", tryout.tryoutId, {
        catalogPosition: 1,
        label: "Set A",
      });

      await ctx.db.insert("tryouts", {
        catalogPosition: 2,
        product: "snbt",
        locale: "id",
        cycleKey: "2026",
        slug: "2026-set-b",
        label: "Set B",
        partCount: 1,
        totalQuestionCount: 20,
        isActive: true,
        detectedAt: NOW,
        syncedAt: NOW,
      });

      await ctx.db.insert("tryoutCatalogMeta", {
        product: "snbt",
        locale: "id",
        activeCount: 2,
        updatedAt: NOW,
      });

      await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "2026-set-a",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      return identity;
    });

    const snapshot = await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .query(api.tryouts.queries.tryouts.getActiveTryoutCatalogSnapshot, {
        locale: "id",
        pageSize: 1,
        product: "snbt",
      });

    expect(snapshot).toEqual({
      activeCount: 2,
      initialPage: [
        expect.objectContaining({
          latestAttempt: expect.objectContaining({
            status: "completed",
          }),
          slug: "2026-set-a",
        }),
      ],
    });
  });

  it("paginates active catalog rows in product order and returns guest rows without status", async () => {
    const t = createTryoutTestConvex();

    await t.mutation(async (ctx) => {
      const labels = [
        {
          catalogPosition: 3,
          cycleKey: "2025",
          label: "Set C",
          slug: "2025-set-c",
        },
        {
          catalogPosition: 2,
          cycleKey: "2026",
          label: "Set B",
          slug: "2026-set-b",
        },
        {
          catalogPosition: 1,
          cycleKey: "2026",
          label: "Set A",
          slug: "2026-set-a",
        },
      ];

      for (const tryout of labels) {
        await ctx.db.insert("tryouts", {
          catalogPosition: tryout.catalogPosition,
          product: "snbt",
          locale: "id",
          cycleKey: tryout.cycleKey,
          slug: tryout.slug,
          label: tryout.label,
          partCount: 1,
          totalQuestionCount: 20,
          isActive: true,
          detectedAt: NOW,
          syncedAt: NOW,
        });
      }

      await ctx.db.insert("tryoutCatalogMeta", {
        product: "snbt",
        locale: "id",
        activeCount: labels.length,
        updatedAt: NOW,
      });
    });

    const firstPage = await t.query(
      api.tryouts.queries.tryouts.getActiveTryoutCatalogPage,
      {
        paginationOpts: {
          cursor: null,
          numItems: 2,
        },
        locale: "id",
        product: "snbt",
      }
    );

    expect(firstPage.page.map((tryout) => tryout.slug)).toEqual([
      "2026-set-a",
      "2026-set-b",
    ]);

    const secondPage = await t.query(
      api.tryouts.queries.tryouts.getActiveTryoutCatalogPage,
      {
        paginationOpts: {
          cursor: firstPage.continueCursor,
          numItems: 2,
        },
        product: "snbt",
        locale: "id",
      }
    );

    expect(secondPage.page.map((tryout) => tryout.slug)).toEqual([
      "2025-set-c",
    ]);
    expect(secondPage.isDone).toBe(true);
    expect(
      secondPage.page.every((tryout) => tryout.latestAttempt === null)
    ).toBe(true);
  });

  it("returns page-local latest attempt status for the authenticated user", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "catalog-page-status",
      });
      const tryout = await insertTryoutSkeleton(ctx, "catalog-page-status");

      await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "catalog-page-status",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      await ctx.db.patch("tryouts", tryout.tryoutId, {
        catalogPosition: 1,
        label: "Catalog Page Status",
      });

      await ctx.db.insert("tryoutCatalogMeta", {
        product: "snbt",
        locale: "id",
        activeCount: 1,
        updatedAt: NOW,
      });

      return identity;
    });

    const result = await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .query(api.tryouts.queries.tryouts.getActiveTryoutCatalogPage, {
        paginationOpts: {
          cursor: null,
          numItems: 10,
        },
        locale: "id",
        product: "snbt",
      });

    expect(result.page).toEqual([
      expect.objectContaining({
        latestAttempt: {
          expiresAtMs: NOW + ATTEMPT_WINDOW_MS,
          status: "completed",
          updatedAt: NOW,
        },
        slug: "catalog-page-status",
      }),
    ]);
  });

  it("caps authenticated catalog pages to the server-side maximum", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "catalog-page-cap",
      });

      for (let index = 0; index < 30; index += 1) {
        const slug = `catalog-page-cap-${index}`;
        const label = `Catalog Page Cap ${index.toString().padStart(2, "0")}`;
        await ctx.db.insert("tryouts", {
          catalogPosition: index + 1,
          product: "snbt",
          locale: "id",
          cycleKey: "2026",
          slug,
          label,
          partCount: 1,
          totalQuestionCount: 20,
          isActive: true,
          detectedAt: NOW,
          syncedAt: NOW,
        });
      }

      await ctx.db.insert("tryoutCatalogMeta", {
        product: "snbt",
        locale: "id",
        activeCount: 30,
        updatedAt: NOW,
      });

      return identity;
    });

    const firstPage = await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .query(api.tryouts.queries.tryouts.getActiveTryoutCatalogPage, {
        paginationOpts: {
          cursor: null,
          numItems: 100,
        },
        locale: "id",
        product: "snbt",
      });

    expect(firstPage.page).toHaveLength(25);
    expect(firstPage.isDone).toBe(false);
    expect(firstPage.page.every((entry) => entry.latestAttempt === null)).toBe(
      true
    );

    const secondPage = await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .query(api.tryouts.queries.tryouts.getActiveTryoutCatalogPage, {
        paginationOpts: {
          cursor: firstPage.continueCursor,
          numItems: 100,
        },
        locale: "id",
        product: "snbt",
      });

    expect(secondPage.page).toHaveLength(5);
    expect(secondPage.isDone).toBe(true);
  });
});

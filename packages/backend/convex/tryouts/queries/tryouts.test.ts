import { api } from "@repo/backend/convex/_generated/api";
import { tryoutProductPolicies } from "@repo/backend/convex/tryouts/products";
import {
  createTryoutTestConvex,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/queries/tryouts", () => {
  it("returns the exact active catalog count for one product and locale", async () => {
    const t = createTryoutTestConvex();

    await t.mutation(async (ctx) => {
      for (let index = 0; index < 3; index += 1) {
        const tryoutId = await ctx.db.insert("tryouts", {
          product: "snbt",
          locale: "id",
          cycleKey: "2026",
          slug: `active-tryout-${index}`,
          label: `Active Tryout ${index}`,
          partCount: 1,
          totalQuestionCount: 20,
          isActive: true,
          detectedAt: NOW,
          syncedAt: NOW,
        });

        await ctx.db.insert("tryoutCatalogEntries", {
          tryoutId,
          product: "snbt",
          locale: "id",
          cycleKey: "2026",
          slug: `active-tryout-${index}`,
          label: `Active Tryout ${index}`,
          partCount: 1,
          totalQuestionCount: 20,
          isActive: true,
          catalogSortKey: tryoutProductPolicies.snbt.getCatalogSortKey({
            cycleKey: "2026",
            label: `Active Tryout ${index}`,
            slug: `active-tryout-${index}`,
          }),
          updatedAt: NOW,
        });
      }

      await ctx.db.insert("tryoutCatalogMeta", {
        product: "snbt",
        locale: "id",
        activeCount: 3,
        updatedAt: NOW,
      });
    });

    const result = await t.query(
      api.tryouts.queries.tryouts.getActiveTryoutCatalogMeta,
      {
        locale: "id",
        product: "snbt",
      }
    );

    expect(result).toEqual({ activeCount: 3 });
  });

  it("paginates active catalog rows in product order and returns guest rows without status", async () => {
    const t = createTryoutTestConvex();

    await t.mutation(async (ctx) => {
      const labels = [
        { cycleKey: "2025", label: "Set C", slug: "2025-set-c" },
        { cycleKey: "2026", label: "Set B", slug: "2026-set-b" },
        { cycleKey: "2026", label: "Set A", slug: "2026-set-a" },
      ];

      for (const tryout of labels) {
        const tryoutId = await ctx.db.insert("tryouts", {
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

        await ctx.db.insert("tryoutCatalogEntries", {
          tryoutId,
          product: "snbt",
          locale: "id",
          cycleKey: tryout.cycleKey,
          slug: tryout.slug,
          label: tryout.label,
          partCount: 1,
          totalQuestionCount: 20,
          isActive: true,
          catalogSortKey: tryoutProductPolicies.snbt.getCatalogSortKey({
            cycleKey: tryout.cycleKey,
            label: tryout.label,
            slug: tryout.slug,
          }),
          updatedAt: NOW,
        });
      }
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
  });
});

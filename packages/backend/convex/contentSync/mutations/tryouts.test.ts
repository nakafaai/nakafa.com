import { internal } from "@repo/backend/convex/_generated/api";
import {
  createTryoutTestConvex,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { getSubjects } from "@repo/contents/exercises/high-school/_data/subject";
import { describe, expect, it } from "vitest";

describe("contentSync/mutations/tryouts", () => {
  it("backfills catalog rows for an unchanged detected tryout", async () => {
    const t = createTryoutTestConvex();

    await t.mutation(async (ctx) => {
      const snbtSubjects = getSubjects("snbt");
      const tryoutId = await ctx.db.insert("tryouts", {
        product: "snbt",
        locale: "id",
        cycleKey: "2026",
        slug: "2026-set-1",
        label: "Set 1",
        partCount: snbtSubjects.length,
        totalQuestionCount: snbtSubjects.length,
        isActive: true,
        detectedAt: NOW,
        syncedAt: NOW,
      });

      for (const [index, subject] of snbtSubjects.entries()) {
        const setId = await ctx.db.insert("exerciseSets", {
          locale: "id",
          slug: `exercises/high-school/snbt/${subject.label}/try-out/2026/set-1`,
          category: "high-school",
          type: "snbt",
          material: subject.label,
          exerciseType: "try-out",
          setName: "set-1",
          title: "Set 1",
          questionCount: 1,
          syncedAt: NOW,
        });

        await ctx.db.insert("exerciseQuestions", {
          setId,
          locale: "id",
          slug: `exercises/high-school/snbt/${subject.label}/try-out/2026/set-1/1`,
          category: "high-school",
          type: "snbt",
          material: subject.label,
          exerciseType: "try-out",
          setName: "set-1",
          number: 1,
          title: `Question ${subject.label}`,
          date: NOW,
          questionBody: "Question body",
          answerBody: "Answer body",
          contentHash: `hash-${subject.label}`,
          syncedAt: NOW,
        });

        await ctx.db.insert("tryoutPartSets", {
          tryoutId,
          setId,
          partIndex: index,
          partKey: subject.label,
        });
      }
    });

    const result = await t.mutation(
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      {
        locale: "id",
        product: "snbt",
      }
    );

    const state = await t.query(async (ctx) => {
      const catalogEntry = await ctx.db
        .query("tryoutCatalogEntries")
        .withIndex(
          "by_product_and_locale_and_isActive_and_catalogSortKey",
          (q) => q.eq("product", "snbt").eq("locale", "id").eq("isActive", true)
        )
        .unique();
      const catalogMeta = await ctx.db
        .query("tryoutCatalogMeta")
        .withIndex("by_product_and_locale", (q) =>
          q.eq("product", "snbt").eq("locale", "id")
        )
        .unique();

      return { catalogEntry, catalogMeta };
    });

    expect(result).toEqual({ created: 0, unchanged: 0, updated: 1 });
    expect(state.catalogEntry).toEqual(
      expect.objectContaining({
        cycleKey: "2026",
        isActive: true,
        label: "Set 1",
        slug: "2026-set-1",
      })
    );
    expect(state.catalogMeta).toEqual(
      expect.objectContaining({
        activeCount: 1,
        locale: "id",
        product: "snbt",
      })
    );
  });
});

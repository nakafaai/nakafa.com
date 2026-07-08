import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 7, 12, 0, 0);

describe("tryouts/queries/catalog", () => {
  it("hides exam page sets until their section snapshot is ready", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("tryoutCountries", {
        countryKey: "indonesia",
        isActive: true,
        locale: "id",
        order: 1,
        publicPath: "try-out/indonesia",
        sourceRevision: "2026",
        syncedAt: NOW,
        title: "Indonesia",
      });
      await ctx.db.insert("tryoutExams", {
        countryKey: "indonesia",
        examKey: "snbt",
        isActive: true,
        locale: "id",
        order: 1,
        publicPath: "try-out/indonesia/snbt",
        scoringStrategy: "irt",
        sourceRevision: "2026",
        syncedAt: NOW,
        title: "SNBT",
      });
      const readySetId = await ctx.db.insert("tryoutSets", {
        countryKey: "indonesia",
        examKey: "snbt",
        isActive: true,
        locale: "id",
        order: 1,
        publicPath: "try-out/indonesia/snbt/set-1",
        scoringStrategy: "irt",
        sectionCount: 1,
        setKey: "set-1",
        sourceRevision: "2026",
        syncedAt: NOW,
        title: "Set 1",
        totalQuestionCount: 1,
      });
      const staleSetId = await ctx.db.insert("tryoutSets", {
        countryKey: "indonesia",
        examKey: "snbt",
        isActive: true,
        locale: "id",
        order: 2,
        publicPath: "try-out/indonesia/snbt/set-2",
        scoringStrategy: "irt",
        sectionCount: 1,
        setKey: "set-2",
        sourceRevision: "2026",
        syncedAt: NOW,
        title: "Set 2",
        totalQuestionCount: 1,
      });
      const readyQuestionSetId = await ctx.db.insert("questionSets", {
        contentHash: "ready-question-set-hash",
        countryKey: "indonesia",
        examKey: "snbt",
        locale: "id",
        questionCount: 1,
        sectionKey: "penalaran-matematika",
        setKey: "set-1",
        sourcePath:
          "question-bank/tryout/indonesia/snbt/set-1/penalaran-matematika",
        sourceRevision: "2026",
        syncedAt: NOW,
        title: "Penalaran Matematika",
      });
      const staleQuestionSetId = await ctx.db.insert("questionSets", {
        contentHash: "stale-question-set-hash",
        countryKey: "indonesia",
        examKey: "snbt",
        locale: "id",
        questionCount: 1,
        sectionKey: "penalaran-matematika",
        setKey: "set-2",
        sourcePath:
          "question-bank/tryout/indonesia/snbt/set-2/penalaran-matematika",
        sourceRevision: "2025",
        syncedAt: NOW,
        title: "Penalaran Matematika",
      });

      await ctx.db.insert("tryoutSections", {
        countryKey: "indonesia",
        examKey: "snbt",
        locale: "id",
        order: 1,
        publicPath: "try-out/indonesia/snbt/set-1/penalaran-matematika",
        questionCount: 1,
        questionSetId: readyQuestionSetId,
        questionSourcePath:
          "question-bank/tryout/indonesia/snbt/set-1/penalaran-matematika",
        sectionKey: "penalaran-matematika",
        setKey: "set-1",
        sourceRevision: "2026",
        syncedAt: NOW,
        timeLimitSeconds: 1800,
        title: "Penalaran Matematika",
        tryoutSetId: readySetId,
      });
      await ctx.db.insert("tryoutSections", {
        countryKey: "indonesia",
        examKey: "snbt",
        locale: "id",
        order: 1,
        publicPath: "try-out/indonesia/snbt/set-2/penalaran-matematika",
        questionCount: 1,
        questionSetId: staleQuestionSetId,
        questionSourcePath:
          "question-bank/tryout/indonesia/snbt/set-2/penalaran-matematika",
        sectionKey: "penalaran-matematika",
        setKey: "set-2",
        sourceRevision: "2025",
        syncedAt: NOW,
        timeLimitSeconds: 1800,
        title: "Penalaran Matematika",
        tryoutSetId: staleSetId,
      });
    });

    const page = await t.query(api.tryouts.queries.catalog.getExamPage, {
      locale: "id",
      publicPath: "try-out/indonesia/snbt",
    });

    expect(page?.sets.map((set) => set.setKey)).toEqual(["set-1"]);
  });

  it("hides set pages until every section row is synced", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const questionSetId = await ctx.db.insert("questionSets", {
        contentHash: "question-set-hash",
        countryKey: "indonesia",
        examKey: "snbt",
        locale: "id",
        questionCount: 1,
        sectionKey: "penalaran-matematika",
        setKey: "set-1",
        sourcePath:
          "question-bank/tryout/indonesia/snbt/set-1/penalaran-matematika",
        sourceRevision: "2026",
        syncedAt: NOW,
        title: "Penalaran Matematika",
      });
      const setId = await ctx.db.insert("tryoutSets", {
        countryKey: "indonesia",
        examKey: "snbt",
        isActive: true,
        locale: "id",
        order: 1,
        publicPath: "try-out/indonesia/snbt/set-1",
        scoringStrategy: "irt",
        sectionCount: 2,
        setKey: "set-1",
        sourceRevision: "2026",
        syncedAt: NOW,
        title: "Set 1",
        totalQuestionCount: 2,
      });

      await ctx.db.insert("tryoutExams", {
        countryKey: "indonesia",
        examKey: "snbt",
        isActive: true,
        locale: "id",
        order: 1,
        publicPath: "try-out/indonesia/snbt",
        scoringStrategy: "irt",
        sourceRevision: "2026",
        syncedAt: NOW,
        title: "SNBT",
      });
      await ctx.db.insert("tryoutSections", {
        countryKey: "indonesia",
        examKey: "snbt",
        locale: "id",
        order: 1,
        publicPath: "try-out/indonesia/snbt/set-1/penalaran-matematika",
        questionCount: 1,
        questionSetId,
        questionSourcePath:
          "question-bank/tryout/indonesia/snbt/set-1/penalaran-matematika",
        sectionKey: "penalaran-matematika",
        setKey: "set-1",
        sourceRevision: "2026",
        syncedAt: NOW,
        timeLimitSeconds: 1800,
        title: "Penalaran Matematika",
        tryoutSetId: setId,
      });
    });

    const page = await t.query(api.tryouts.queries.catalog.getSetPage, {
      locale: "id",
      publicPath: "try-out/indonesia/snbt/set-1",
    });

    expect(page).toBeNull();
  });

  it("hides set pages until section revisions and question totals match", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const questionSetId = await ctx.db.insert("questionSets", {
        contentHash: "question-set-hash",
        countryKey: "indonesia",
        examKey: "snbt",
        locale: "id",
        questionCount: 1,
        sectionKey: "penalaran-matematika",
        setKey: "set-1",
        sourcePath:
          "question-bank/tryout/indonesia/snbt/set-1/penalaran-matematika",
        sourceRevision: "2025",
        syncedAt: NOW,
        title: "Penalaran Matematika",
      });
      const setId = await ctx.db.insert("tryoutSets", {
        countryKey: "indonesia",
        examKey: "snbt",
        isActive: true,
        locale: "id",
        order: 1,
        publicPath: "try-out/indonesia/snbt/set-1",
        scoringStrategy: "irt",
        sectionCount: 1,
        setKey: "set-1",
        sourceRevision: "2026",
        syncedAt: NOW,
        title: "Set 1",
        totalQuestionCount: 2,
      });

      await ctx.db.insert("tryoutExams", {
        countryKey: "indonesia",
        examKey: "snbt",
        isActive: true,
        locale: "id",
        order: 1,
        publicPath: "try-out/indonesia/snbt",
        scoringStrategy: "irt",
        sourceRevision: "2026",
        syncedAt: NOW,
        title: "SNBT",
      });
      await ctx.db.insert("tryoutSections", {
        countryKey: "indonesia",
        examKey: "snbt",
        locale: "id",
        order: 1,
        publicPath: "try-out/indonesia/snbt/set-1/penalaran-matematika",
        questionCount: 1,
        questionSetId,
        questionSourcePath:
          "question-bank/tryout/indonesia/snbt/set-1/penalaran-matematika",
        sectionKey: "penalaran-matematika",
        setKey: "set-1",
        sourceRevision: "2025",
        syncedAt: NOW,
        timeLimitSeconds: 1800,
        title: "Penalaran Matematika",
        tryoutSetId: setId,
      });
    });

    const page = await t.query(api.tryouts.queries.catalog.getSetPage, {
      locale: "id",
      publicPath: "try-out/indonesia/snbt/set-1",
    });

    expect(page).toBeNull();
  });
});

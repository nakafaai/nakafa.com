import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertTryoutCountry,
  insertTryoutExam,
  insertTryoutQuestionSource,
  insertTryoutSection,
  insertTryoutSet,
  insertTryoutTrack,
  TRYOUT_EXAM_PATH,
  TRYOUT_SECTION_PATH,
  TRYOUT_SET_PATH,
} from "@repo/backend/test/tryouts";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("tryouts/queries/catalog", () => {
  it("hides exam page tracks until their materialized readiness is true", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);
      await insertTryoutTrack(ctx, {
        isReady: false,
        publicPath: `${TRYOUT_EXAM_PATH}/2028`,
        trackKey: "2028",
      });
    });

    const page = await t.query(api.tryouts.queries.catalog.getExamPage, {
      locale: "id",
      publicPath: TRYOUT_EXAM_PATH,
    });

    expect(page?.tracks.map((track) => track.trackKey)).toEqual(["2027"]);
  });

  it("does not expose legacy exam-to-set paths as track pages", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);
    });

    const page = await t.query(api.tryouts.queries.catalog.getTrackPage, {
      locale: "id",
      publicPath: `${TRYOUT_EXAM_PATH}/set-1`,
    });

    expect(page).toBeNull();
  });

  it("hides set pages until every section row is synced", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);
      const setId = await insertTryoutSet(ctx, {
        sectionCount: 2,
        totalQuestionCount: 2,
      });
      const questionSetId = await insertTryoutQuestionSource(ctx);

      await insertTryoutSection(ctx, {
        publicPath: TRYOUT_SECTION_PATH,
        questionSetId,
        tryoutSetId: setId,
      });
    });

    const page = await t.query(api.tryouts.queries.catalog.getSetPage, {
      locale: "id",
      publicPath: TRYOUT_SET_PATH,
    });

    expect(page).toBeNull();
  });

  it("hides set pages until section revisions and question totals match", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);
      const setId = await insertTryoutSet(ctx, {
        totalQuestionCount: 2,
      });
      const questionSetId = await insertTryoutQuestionSource(ctx, {
        sourceRevision: "2025",
      });

      await insertTryoutSection(ctx, {
        publicPath: TRYOUT_SECTION_PATH,
        questionSetId,
        sourceRevision: "2025",
        tryoutSetId: setId,
      });
    });

    const page = await t.query(api.tryouts.queries.catalog.getSetPage, {
      locale: "id",
      publicPath: TRYOUT_SET_PATH,
    });

    expect(page).toBeNull();
  });

  it("serves internal-entry set pages without a public section route", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx, {
        publicPath: `${TRYOUT_EXAM_PATH}/matematika`,
        trackKey: "mathematics",
        trackKind: "subject",
      });
      const setId = await insertTryoutSet(ctx, {
        internalEntrySectionKey: "mathematics",
        publicPath: `${TRYOUT_EXAM_PATH}/matematika/set-1`,
        trackKey: "mathematics",
        visibleSectionCount: 0,
      });
      const sourcePath =
        "question-bank/tryout/indonesia/snbt/mathematics/set-1/mathematics";
      const questionSetId = await insertTryoutQuestionSource(ctx, {
        sectionKey: "mathematics",
        sourcePath,
      });

      await insertTryoutSection(ctx, {
        publicPath: undefined,
        questionSetId,
        questionSourcePath: sourcePath,
        sectionKey: "mathematics",
        trackKey: "mathematics",
        tryoutSetId: setId,
        visibility: "internal-entry",
      });
    });

    const page = await t.query(api.tryouts.queries.catalog.getSetPage, {
      locale: "id",
      publicPath: `${TRYOUT_EXAM_PATH}/matematika/set-1`,
    });

    expect(page?.sections).toEqual([]);
    expect(page?.entrySection).toMatchObject({
      sectionKey: "mathematics",
      visibility: "internal-entry",
    });
    expect(page?.entrySection?.publicPath).toBeUndefined();
    expect(page).not.toHaveProperty("entryQuestions");
  });

  it("hides direct set and section pages when their country is inactive", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const countryId = await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);
      const setId = await insertTryoutSet(ctx);
      const questionSetId = await insertTryoutQuestionSource(ctx);

      await insertTryoutSection(ctx, {
        publicPath: TRYOUT_SECTION_PATH,
        questionSetId,
        tryoutSetId: setId,
      });
      await ctx.db.patch(countryId, { isActive: false });
    });

    const setPage = await t.query(api.tryouts.queries.catalog.getSetPage, {
      locale: "id",
      publicPath: TRYOUT_SET_PATH,
    });
    const sectionPage = await t.query(
      api.tryouts.queries.catalog.getSectionPage,
      {
        locale: "id",
        publicPath: TRYOUT_SECTION_PATH,
      }
    );

    expect(setPage).toBeNull();
    expect(sectionPage).toBeNull();
  });
});

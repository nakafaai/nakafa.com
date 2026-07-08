import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 7, 12, 0, 0);
const COUNTRY_PATH = "try-out/indonesia";
const SNBT_PATH = `${COUNTRY_PATH}/snbt`;
const SNBT_TRACK_PATH = `${SNBT_PATH}/2027`;
const SNBT_SET_PATH = `${SNBT_TRACK_PATH}/set-1`;
const SNBT_SECTION_KEY = "penalaran-matematika";
const SNBT_SECTION_PATH = `${SNBT_SET_PATH}/${SNBT_SECTION_KEY}`;
const SNBT_SOURCE =
  "question-bank/tryout/indonesia/snbt/2027/set-1/penalaran-matematika";

/** Inserts the active Indonesia country row used by try-out catalog tests. */
async function insertCountry(ctx: MutationCtx) {
  return await ctx.db.insert("tryoutCountries", {
    countryKey: "indonesia",
    isActive: true,
    locale: "id",
    order: 1,
    publicPath: COUNTRY_PATH,
    sourceRevision: "2026",
    syncedAt: NOW,
    title: "Indonesia",
  });
}

/** Inserts one active exam row for a test catalog tree. */
async function insertExam(ctx: MutationCtx, examKey = "snbt") {
  return await ctx.db.insert("tryoutExams", {
    countryKey: "indonesia",
    examKey,
    isActive: true,
    locale: "id",
    order: 1,
    publicPath: `${COUNTRY_PATH}/${examKey}`,
    scoringStrategy: "irt",
    sourceRevision: "2026",
    syncedAt: NOW,
    title: examKey.toUpperCase(),
  });
}

/** Inserts one track row with the supplied materialized readiness state. */
async function insertTrack(
  ctx: MutationCtx,
  args: {
    examKey?: string;
    isReady?: boolean;
    publicPath?: string;
    trackKey?: string;
    trackKind?: "subject" | "year";
  } = {}
) {
  const examKey = args.examKey ?? "snbt";
  const trackKey = args.trackKey ?? "2027";

  return await ctx.db.insert("tryoutTracks", {
    authoredSetCount: 1,
    countryKey: "indonesia",
    examKey,
    isActive: true,
    isReady: args.isReady ?? true,
    locale: "id",
    order: 1,
    publicPath: args.publicPath ?? `${COUNTRY_PATH}/${examKey}/${trackKey}`,
    readyQuestionCount: args.isReady === false ? 0 : 1,
    readySetCount: args.isReady === false ? 0 : 1,
    readyVisibleSectionCount: args.isReady === false ? 0 : 1,
    sourceRevision: "2026",
    syncedAt: NOW,
    title: trackKey === "2027" ? "Tahun 2027" : "Matematika",
    trackKey,
    trackKind: args.trackKind ?? "year",
  });
}

/** Inserts one set row under a track using the public catalog table contract. */
async function insertSet(
  ctx: MutationCtx,
  args: {
    internalEntrySectionKey?: string;
    isReady?: boolean;
    publicPath?: string;
    sectionCount?: number;
    setKey?: string;
    totalQuestionCount?: number;
    trackKey?: string;
    visibleSectionCount?: number;
  } = {}
) {
  const trackKey = args.trackKey ?? "2027";
  const setKey = args.setKey ?? "set-1";
  const totalQuestionCount = args.totalQuestionCount ?? 1;
  const visibleSectionCount = args.visibleSectionCount ?? 1;

  return await ctx.db.insert("tryoutSets", {
    countryKey: "indonesia",
    examKey: "snbt",
    internalEntrySectionKey: args.internalEntrySectionKey,
    isActive: true,
    isReady: args.isReady ?? true,
    locale: "id",
    order: setKey === "set-1" ? 1 : 2,
    publicPath: args.publicPath ?? `${SNBT_TRACK_PATH}/${setKey}`,
    readyQuestionCount: args.isReady === false ? 0 : totalQuestionCount,
    readyVisibleSectionCount: args.isReady === false ? 0 : visibleSectionCount,
    scoringStrategy: "irt",
    sectionCount: args.sectionCount ?? 1,
    setKey,
    sourceRevision: "2026",
    syncedAt: NOW,
    title: setKey === "set-1" ? "Set 1" : "Set 2",
    totalQuestionCount,
    trackKey,
    visibleSectionCount,
  });
}

/** Inserts one question-set row and, optionally, a ready question row. */
async function insertQuestionSource(
  ctx: MutationCtx,
  args: {
    questionCount?: number;
    sectionKey?: string;
    setKey?: string;
    sourcePath?: string;
    sourceRevision?: string;
    withQuestion?: boolean;
  } = {}
) {
  const sectionKey = args.sectionKey ?? SNBT_SECTION_KEY;
  const sourcePath = args.sourcePath ?? SNBT_SOURCE;
  const sourceRevision = args.sourceRevision ?? "2026";
  const questionCount = args.questionCount ?? 1;
  const questionSetId = await ctx.db.insert("questionSets", {
    contentHash: `${sourcePath}:hash`,
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    questionCount,
    sectionKey,
    setKey: args.setKey ?? "set-1",
    sourcePath,
    sourceRevision,
    syncedAt: NOW,
    title: "Penalaran Matematika",
  });

  if (args.withQuestion ?? true) {
    await ctx.db.insert("questions", {
      answerBody: "Answer",
      contentHash: `${sourcePath}:question-hash`,
      date: 0,
      locale: "id",
      number: 1,
      questionBody: "Question",
      questionSetId,
      sourceKey: `${sourcePath}:question-1`,
      sourcePath: `${sourcePath}/question-1`,
      sourceRevision,
      syncedAt: NOW,
      title: "Question",
    });
  }

  return questionSetId;
}

/** Inserts one try-out section row backed by a question-set source. */
async function insertSection(
  ctx: MutationCtx,
  args: {
    publicPath?: string;
    questionCount?: number;
    questionSetId: Id<"questionSets">;
    questionSourcePath?: string;
    sectionKey?: string;
    sourceRevision?: string;
    trackKey?: string;
    tryoutSetId: Id<"tryoutSets">;
    visibility?: "internal-entry" | "visible";
  }
) {
  return await ctx.db.insert("tryoutSections", {
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    order: 1,
    publicPath: args.publicPath,
    questionCount: args.questionCount ?? 1,
    questionSetId: args.questionSetId,
    questionSourcePath: args.questionSourcePath ?? SNBT_SOURCE,
    sectionKey: args.sectionKey ?? SNBT_SECTION_KEY,
    setKey: "set-1",
    sourceRevision: args.sourceRevision ?? "2026",
    syncedAt: NOW,
    timeLimitSeconds: 1800,
    title: "Penalaran Matematika",
    trackKey: args.trackKey ?? "2027",
    tryoutSetId: args.tryoutSetId,
    visibility: args.visibility ?? "visible",
  });
}

describe("tryouts/queries/catalog", () => {
  it("hides exam page tracks until their materialized readiness is true", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertCountry(ctx);
      await insertExam(ctx);
      await insertTrack(ctx);
      await insertTrack(ctx, {
        isReady: false,
        publicPath: `${SNBT_PATH}/2028`,
        trackKey: "2028",
      });
    });

    const page = await t.query(api.tryouts.queries.catalog.getExamPage, {
      locale: "id",
      publicPath: SNBT_PATH,
    });

    expect(page?.tracks.map((track) => track.trackKey)).toEqual(["2027"]);
  });

  it("lists ready sets under a ready track with Convex pagination", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertCountry(ctx);
      await insertExam(ctx);
      await insertTrack(ctx);
      await insertSet(ctx);
      await insertSet(ctx, {
        isReady: false,
        publicPath: `${SNBT_TRACK_PATH}/set-2`,
        setKey: "set-2",
      });
    });

    const page = await t.query(api.tryouts.queries.catalog.listTrackSets, {
      countryKey: "indonesia",
      examKey: "snbt",
      locale: "id",
      paginationOpts: { cursor: null, numItems: 10 },
      trackKey: "2027",
    });

    expect(page.page.map((set) => set.setKey)).toEqual(["set-1"]);
  });

  it("does not expose legacy exam-to-set paths as track pages", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertCountry(ctx);
      await insertExam(ctx);
      await insertTrack(ctx);
    });

    const page = await t.query(api.tryouts.queries.catalog.getTrackPage, {
      locale: "id",
      publicPath: `${SNBT_PATH}/set-1`,
    });

    expect(page).toBeNull();
  });

  it("hides set pages until every section row is synced", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertExam(ctx);
      await insertTrack(ctx);
      const setId = await insertSet(ctx, {
        sectionCount: 2,
        totalQuestionCount: 2,
      });
      const questionSetId = await insertQuestionSource(ctx);

      await insertSection(ctx, {
        publicPath: SNBT_SECTION_PATH,
        questionSetId,
        tryoutSetId: setId,
      });
    });

    const page = await t.query(api.tryouts.queries.catalog.getSetPage, {
      locale: "id",
      publicPath: SNBT_SET_PATH,
    });

    expect(page).toBeNull();
  });

  it("hides set pages until section revisions and question totals match", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertExam(ctx);
      await insertTrack(ctx);
      const setId = await insertSet(ctx, {
        totalQuestionCount: 2,
      });
      const questionSetId = await insertQuestionSource(ctx, {
        sourceRevision: "2025",
      });

      await insertSection(ctx, {
        publicPath: SNBT_SECTION_PATH,
        questionSetId,
        sourceRevision: "2025",
        tryoutSetId: setId,
      });
    });

    const page = await t.query(api.tryouts.queries.catalog.getSetPage, {
      locale: "id",
      publicPath: SNBT_SET_PATH,
    });

    expect(page).toBeNull();
  });

  it("serves internal-entry set pages without a public section route", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertExam(ctx);
      await insertTrack(ctx, {
        publicPath: `${SNBT_PATH}/matematika`,
        trackKey: "mathematics",
        trackKind: "subject",
      });
      const setId = await insertSet(ctx, {
        internalEntrySectionKey: "mathematics",
        publicPath: `${SNBT_PATH}/matematika/set-1`,
        trackKey: "mathematics",
        visibleSectionCount: 0,
      });
      const sourcePath =
        "question-bank/tryout/indonesia/snbt/mathematics/set-1/mathematics";
      const questionSetId = await insertQuestionSource(ctx, {
        sectionKey: "mathematics",
        sourcePath,
      });

      await insertSection(ctx, {
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
      publicPath: `${SNBT_PATH}/matematika/set-1`,
    });

    expect(page?.sections).toEqual([]);
    expect(page?.entrySection).toMatchObject({
      sectionKey: "mathematics",
      visibility: "internal-entry",
    });
    expect(page?.entrySection?.publicPath).toBeUndefined();
    expect(page?.entryQuestions).toEqual([
      {
        contentHash:
          "question-bank/tryout/indonesia/snbt/mathematics/set-1/mathematics:question-hash",
        questionOrder: 1,
        sourcePath:
          "question-bank/tryout/indonesia/snbt/mathematics/set-1/mathematics/question-1",
        sourceRevision: "2026",
      },
    ]);
  });
});

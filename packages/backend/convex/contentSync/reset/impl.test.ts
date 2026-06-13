import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentity } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { deleteBatchFromTable } from "./impl";

describe("contentSync/reset/impl", () => {
  it("deletes runtime and analytics rows through bounded reset batches", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(seedDerivedRuntimeRows);

    const routeDelete = await t.mutation(deleteContentRoutesBatch);
    const viewDelete = await t.mutation(deleteContentViewsBatch);
    const queueDelete = await t.mutation(deleteContentViewAnalyticsQueueBatch);
    const partitionDelete = await t.mutation(
      deleteContentAnalyticsPartitionsBatch
    );
    const articlePopularityDelete = await t.mutation(
      deleteArticlePopularityBatch
    );
    const subjectPopularityDelete = await t.mutation(
      deleteSubjectPopularityBatch
    );
    const exercisePopularityDelete = await t.mutation(
      deleteExercisePopularityBatch
    );
    const trendingDelete = await t.mutation(deleteSubjectTrendingBucketsBatch);
    const verseDelete = await t.mutation(deleteQuranVersesBatch);
    const surahDelete = await t.mutation(deleteQuranSurahsBatch);
    const counts = await t.query(getDerivedRuntimeRows);

    expect(routeDelete).toEqual({ deleted: 1, hasMore: false });
    expect(viewDelete).toEqual({ deleted: 1, hasMore: false });
    expect(queueDelete).toEqual({ deleted: 1, hasMore: false });
    expect(partitionDelete).toEqual({ deleted: 1, hasMore: false });
    expect(articlePopularityDelete).toEqual({ deleted: 1, hasMore: false });
    expect(subjectPopularityDelete).toEqual({ deleted: 1, hasMore: false });
    expect(exercisePopularityDelete).toEqual({ deleted: 1, hasMore: false });
    expect(trendingDelete).toEqual({ deleted: 1, hasMore: false });
    expect(verseDelete).toEqual({ deleted: 1, hasMore: false });
    expect(surahDelete).toEqual({ deleted: 1, hasMore: false });
    expect(counts).toEqual({
      articlePopularity: [],
      contentAnalyticsPartitions: [],
      contentViewAnalyticsQueue: [],
      contentViews: [],
      exercisePopularity: [],
      routes: [],
      subjectPopularity: [],
      subjectTrendingBuckets: [],
      surahs: [],
      verses: [],
    });
  });
});

/** Seeds the content-derived runtime rows newly managed by reset. */
async function seedDerivedRuntimeRows(ctx: MutationCtx) {
  const graph = quranRouteGraph();

  await ctx.db.insert("contentRoutes", {
    ...graph,
    authors: [],
    contentHash: "route-hash",
    kind: "quran-surah",
    locale: "id",
    markdown: true,
    route: "quran/1",
    section: "quran",
    syncedAt: 1,
    title: "Al-Fatihah",
  });
  await ctx.db.insert("contentViews", {
    ...graph,
    deviceId: "device-1",
    firstViewedAt: 1,
    lastViewedAt: 2,
    locale: "id",
    route: "quran/1",
    section: "quran",
  });
  await ctx.db.insert("contentViewAnalyticsQueue", {
    ...graph,
    locale: "id",
    partition: 0,
    route: "quran/1",
    section: "quran",
    viewedAt: 2,
  });
  await ctx.db.insert("contentAnalyticsPartitions", {
    leaseExpiresAt: 10,
    leaseVersion: 1,
    partition: 0,
  });
  await ctx.db.insert("articlePopularity", {
    ...graph,
    updatedAt: 2,
    viewCount: 1,
  });
  await ctx.db.insert("subjectPopularity", {
    ...graph,
    updatedAt: 2,
    viewCount: 1,
  });
  await ctx.db.insert("exercisePopularity", {
    ...graph,
    updatedAt: 2,
    viewCount: 1,
  });
  await ctx.db.insert("subjectTrendingBuckets", {
    ...graph,
    bucketStart: 0,
    locale: "id",
    updatedAt: 2,
    viewCount: 1,
  });
  await ctx.db.insert("quranSurahs", {
    contentHash: "surah-hash",
    name: {
      long: "Al-Fatihah",
      short: "الفاتحة",
      translation: { en: "The Opening", id: "Pembukaan" },
      transliteration: { en: "Al-Fatihah", id: "Al-Fatihah" },
    },
    number: 1,
    numberOfVerses: 1,
    preBismillah: null,
    revelation: { arab: "مكية", en: "Meccan", id: "Makkiyah" },
    sequence: 5,
    syncedAt: 1,
  });
  await ctx.db.insert("quranVerses", {
    audio: { primary: "https://example.test/1.mp3", secondary: [] },
    contentHash: "verse-hash",
    hizbQuarter: 1,
    juz: 1,
    manzil: 1,
    page: 1,
    quranNumber: 1,
    ruku: 1,
    sajdaObligatory: false,
    sajdaRecommended: false,
    surahNumber: 1,
    syncedAt: 1,
    tafsir: { id: { long: "Tafsir panjang", short: "Tafsir pendek" } },
    text: { arab: "بسم الله", transliteration: { en: "Bismillah" } },
    translation: { en: "In the name of Allah", id: "Dengan nama Allah" },
    verseNumber: 1,
  });
}

/** Builds graph identity fields for the reset Quran route fixture. */
function quranRouteGraph() {
  const identity = createLearningGraphIdentity({
    kind: "quran-surah",
    locale: "id",
    route: "quran/1",
  });

  return {
    ...identity,
    content_id: identity.assetId,
  };
}

/** Deletes one content route reset batch through the shared reset helper. */
async function deleteContentRoutesBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "contentRoutes");
}

/** Deletes one content view reset batch through the shared reset helper. */
async function deleteContentViewsBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "contentViews");
}

/** Deletes one content view analytics queue reset batch. */
async function deleteContentViewAnalyticsQueueBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "contentViewAnalyticsQueue");
}

/** Deletes one content analytics partition reset batch. */
async function deleteContentAnalyticsPartitionsBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "contentAnalyticsPartitions");
}

/** Deletes one article popularity reset batch. */
async function deleteArticlePopularityBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "articlePopularity");
}

/** Deletes one subject popularity reset batch. */
async function deleteSubjectPopularityBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "subjectPopularity");
}

/** Deletes one exercise popularity reset batch. */
async function deleteExercisePopularityBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "exercisePopularity");
}

/** Deletes one subject trending bucket reset batch. */
async function deleteSubjectTrendingBucketsBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "subjectTrendingBuckets");
}

/** Deletes one Quran verse reset batch through the shared reset helper. */
async function deleteQuranVersesBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "quranVerses");
}

/** Deletes one Quran surah reset batch through the shared reset helper. */
async function deleteQuranSurahsBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "quranSurahs");
}

/** Reads the derived runtime tables after reset has run. */
async function getDerivedRuntimeRows(ctx: QueryCtx) {
  return {
    articlePopularity: await ctx.db.query("articlePopularity").collect(),
    contentAnalyticsPartitions: await ctx.db
      .query("contentAnalyticsPartitions")
      .collect(),
    contentViewAnalyticsQueue: await ctx.db
      .query("contentViewAnalyticsQueue")
      .collect(),
    contentViews: await ctx.db.query("contentViews").collect(),
    exercisePopularity: await ctx.db.query("exercisePopularity").collect(),
    routes: await ctx.db.query("contentRoutes").collect(),
    subjectPopularity: await ctx.db.query("subjectPopularity").collect(),
    subjectTrendingBuckets: await ctx.db
      .query("subjectTrendingBuckets")
      .collect(),
    surahs: await ctx.db.query("quranSurahs").collect(),
    verses: await ctx.db.query("quranVerses").collect(),
  };
}

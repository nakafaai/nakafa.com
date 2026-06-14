import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
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
    const learningPopularityDelete = await t.mutation(
      deleteLearningPopularityBatch
    );
    const trendingDelete = await t.mutation(deleteLearningTrendingBucketsBatch);
    const verseDelete = await t.mutation(deleteQuranVersesBatch);
    const surahDelete = await t.mutation(deleteQuranSurahsBatch);
    const counts = await t.query(getDerivedRuntimeRows);

    expect(routeDelete).toEqual({ deleted: 1, hasMore: false });
    expect(viewDelete).toEqual({ deleted: 1, hasMore: false });
    expect(queueDelete).toEqual({ deleted: 1, hasMore: false });
    expect(partitionDelete).toEqual({ deleted: 1, hasMore: false });
    expect(learningPopularityDelete).toEqual({ deleted: 1, hasMore: false });
    expect(trendingDelete).toEqual({ deleted: 1, hasMore: false });
    expect(verseDelete).toEqual({ deleted: 1, hasMore: false });
    expect(surahDelete).toEqual({ deleted: 1, hasMore: false });
    expect(counts).toEqual({
      learningPopularity: [],
      contentAnalyticsPartitions: [],
      contentViewAnalyticsQueue: [],
      contentViews: [],
      routes: [],
      learningTrendingBuckets: [],
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
  await ctx.db.insert("learningPopularity", {
    ...graph,
    locale: "id",
    section: "quran",
    updatedAt: 2,
    viewCount: 1,
  });
  await ctx.db.insert("learningTrendingBuckets", {
    ...graph,
    bucketStart: 0,
    locale: "id",
    section: "quran",
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
  const identity = createLearningGraphIdentityFromRoute({
    locale: "id",
    route: "quran/1",
  });

  if (!identity) {
    throw new Error("Expected Quran route graph fixture.");
  }

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

/** Deletes one learning popularity reset batch. */
async function deleteLearningPopularityBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "learningPopularity");
}

/** Deletes one learning trending bucket reset batch. */
async function deleteLearningTrendingBucketsBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "learningTrendingBuckets");
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
    learningPopularity: await ctx.db.query("learningPopularity").collect(),
    contentAnalyticsPartitions: await ctx.db
      .query("contentAnalyticsPartitions")
      .collect(),
    contentViewAnalyticsQueue: await ctx.db
      .query("contentViewAnalyticsQueue")
      .collect(),
    contentViews: await ctx.db.query("contentViews").collect(),
    routes: await ctx.db.query("contentRoutes").collect(),
    learningTrendingBuckets: await ctx.db
      .query("learningTrendingBuckets")
      .collect(),
    surahs: await ctx.db.query("quranSurahs").collect(),
    verses: await ctx.db.query("quranVerses").collect(),
  };
}

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

const canonicalContext = {
  contextKey: "canonical",
  contextMode: "canonical",
} as const;

describe("contentSync/reset/impl", () => {
  it("deletes runtime and analytics rows through bounded reset batches", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(seedDerivedRuntimeRows);

    const routeDelete = await t.mutation(deleteContentRoutesBatch);
    const publicRouteDelete = await t.mutation(deletePublicRoutesBatch);
    const viewDelete = await t.mutation(deleteLearningViewsBatch);
    const queueDelete = await t.mutation(deleteLearningEngagementQueueBatch);
    const partitionDelete = await t.mutation(
      deleteContentAnalyticsPartitionsBatch
    );
    const recentsDelete = await t.mutation(deleteUserLearningRecentsBatch);
    const viewerSignalsDelete = await t.mutation(
      deleteLearningPopularityViewerSignalsBatch
    );
    const popularitySignalsDelete = await t.mutation(
      deleteLearningPopularitySignalsBatch
    );
    const popularityCountersDelete = await t.mutation(
      deleteLearningPopularityCountersBatch
    );
    const planItemDelete = await t.mutation(deleteLearningPlanItemsBatch);
    const verseDelete = await t.mutation(deleteQuranVersesBatch);
    const surahDelete = await t.mutation(deleteQuranSurahsBatch);
    const counts = await t.query(getDerivedRuntimeRows);
    const { learningProgramSources, learningPrograms, ...resetRows } = counts;

    expect(routeDelete).toEqual({ deleted: 1, hasMore: false });
    expect(publicRouteDelete).toEqual({ deleted: 1, hasMore: false });
    expect(viewDelete).toEqual({ deleted: 1, hasMore: false });
    expect(queueDelete).toEqual({ deleted: 1, hasMore: false });
    expect(partitionDelete).toEqual({ deleted: 1, hasMore: false });
    expect(recentsDelete).toEqual({ deleted: 1, hasMore: false });
    expect(viewerSignalsDelete).toEqual({ deleted: 1, hasMore: false });
    expect(popularitySignalsDelete).toEqual({ deleted: 1, hasMore: false });
    expect(popularityCountersDelete).toEqual({ deleted: 1, hasMore: false });
    expect(planItemDelete).toEqual({ deleted: 1, hasMore: false });
    expect(verseDelete).toEqual({ deleted: 1, hasMore: false });
    expect(surahDelete).toEqual({ deleted: 1, hasMore: false });
    expect(learningProgramSources).toEqual([
      expect.objectContaining({ label: "Fixture Source" }),
    ]);
    expect(learningPrograms).toEqual([
      expect.objectContaining({ key: "fixture.program" }),
    ]);
    expect(resetRows).toEqual({
      contentAnalyticsPartitions: [],
      learningEngagementQueue: [],
      learningPopularityCounters: [],
      learningPopularitySignals: [],
      learningPopularityViewerSignals: [],
      learningViews: [],
      learningPlanItems: [],
      publicRoutes: [],
      routes: [],
      surahs: [],
      userLearningRecents: [],
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
    sourcePath: "quran/1",
    syncedAt: 1,
    title: "Al-Fatihah",
  });
  await ctx.db.insert("publicRoutes", {
    kind: "subject-topic",
    locale: "id",
    materialKey: "fixture.material",
    publicPath: "materi/fixture/topik",
    sitemap: true,
    sourcePath: "material/lesson/fixture",
    syncedAt: 1,
    title: "Fixture Topic",
  });
  const recentUserId = await ctx.db.insert("users", {
    authId: "reset-user",
    credits: 0,
    creditsResetAt: 1,
    email: "reset@example.com",
    name: "Reset User",
    plan: "free",
  });

  await ctx.db.insert("learningViews", {
    ...graph,
    ...canonicalContext,
    deviceId: "device-1",
    firstViewedAt: 1,
    lastViewedAt: 2,
    locale: "id",
    route: "quran/1",
    section: "quran",
  });
  await ctx.db.insert("learningEngagementQueue", {
    ...graph,
    ...canonicalContext,
    description: "Quran reset",
    insertedAt: 2,
    locale: "id",
    partition: 0,
    route: "quran/1",
    scopeMode: "global",
    section: "quran",
    sourcePath: "quran/1",
    title: "Al-Fatihah",
    viewerKey: "device:device-1",
    viewedAt: 2,
  });
  await ctx.db.insert("contentAnalyticsPartitions", {
    leaseExpiresAt: 10,
    leaseVersion: 1,
    partition: 0,
  });
  await ctx.db.insert("userLearningRecents", {
    ...graph,
    ...canonicalContext,
    description: "Quran reset",
    lastViewedAt: 2,
    locale: "id",
    route: "quran/1",
    section: "quran",
    sourcePath: "quran/1",
    title: "Al-Fatihah",
    userId: recentUserId,
  });
  await ctx.db.insert("learningPopularityViewerSignals", {
    ...graph,
    ...canonicalContext,
    locale: "id",
    scopeMode: "global",
    section: "quran",
    signalDay: 0,
    viewedAt: 2,
    viewerKey: "device:device-1",
  });
  await ctx.db.insert("learningPopularitySignals", {
    ...graph,
    ...canonicalContext,
    description: "Quran reset",
    locale: "id",
    route: "quran/1",
    scopeMode: "global",
    section: "quran",
    signalDay: 0,
    sourcePath: "quran/1",
    title: "Al-Fatihah",
    updatedAt: 2,
    viewCount: 1,
  });
  await ctx.db.insert("learningPopularityCounters", {
    ...graph,
    ...canonicalContext,
    description: "Quran reset",
    locale: "id",
    route: "quran/1",
    score: 1,
    scopeMode: "global",
    section: "quran",
    sourcePath: "quran/1",
    title: "Al-Fatihah",
    updatedAt: 2,
    windowKey: "7d",
  });
  const userId = await ctx.db.insert("users", {
    authId: "reset-user-auth",
    credits: 0,
    creditsResetAt: 1,
    email: "reset-user@example.test",
    name: "Reset User",
    plan: "free",
  });
  const programId = await ctx.db.insert("learningPrograms", {
    defaultCoverageStatus: "available",
    displayOrder: 1,
    key: "fixture.program",
    kind: "school-curriculum",
    navigation: { levels: ["track"], model: "track-topic" },
    providerHomeCountry: "ID",
    providerKind: "nakafa",
    providerName: "Fixture Provider",
    recommendedCountry: "ID",
    syncedAt: 1,
    translations: {
      en: {
        publicSlug: "fixture-program",
        title: "Fixture Program",
      },
      id: {
        publicSlug: "fixture-program",
        title: "Program Fixture",
      },
    },
    updatedAt: 1,
    versionEndsAt: "2026-12-31",
    versionLabel: "Fixture",
    versionStartsAt: "2026-01-01",
  });
  await ctx.db.insert("learningProgramSources", {
    label: "Fixture Source",
    programId,
    retrievedAt: "2026-01-01",
    syncedAt: 1,
    type: "nakafa-editorial",
    url: "https://example.test/program",
  });
  const profileId = await ctx.db.insert("learningProfiles", {
    interests: ["school-curriculum"],
    programId,
    updatedAt: 1,
    userId,
  });
  const planId = await ctx.db.insert("learningPlans", {
    createdAt: 1,
    profileId,
    programId,
    status: "active",
    updatedAt: 1,
    userId,
    version: 1,
  });
  await ctx.db.insert("learningPlanItems", {
    content_id: graph.content_id,
    coverageStatus: "available",
    createdAt: 1,
    lensId: "fixture.lens",
    lensScope: "curriculum",
    planId,
    position: 1,
    programId,
    reason: "program-alignment",
    route: "quran/1",
    status: "ready",
    title: "Generated Fixture",
    updatedAt: 1,
    userId,
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
    tafsir: { id: { short: "Tafsir pendek" } },
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

/** Deletes one generated public route reset batch. */
async function deletePublicRoutesBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "publicRoutes");
}

/** Deletes one learning view reset batch through the shared reset helper. */
async function deleteLearningViewsBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "learningViews");
}

/** Deletes one learning engagement queue reset batch. */
async function deleteLearningEngagementQueueBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "learningEngagementQueue");
}

/** Deletes one content analytics partition reset batch. */
async function deleteContentAnalyticsPartitionsBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "contentAnalyticsPartitions");
}

/** Deletes one signed-in Continue Learning reset batch. */
async function deleteUserLearningRecentsBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "userLearningRecents");
}

/** Deletes one daily viewer popularity signal reset batch. */
async function deleteLearningPopularityViewerSignalsBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "learningPopularityViewerSignals");
}

/** Deletes one aggregated daily popularity signal reset batch. */
async function deleteLearningPopularitySignalsBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "learningPopularitySignals");
}

/** Deletes one ranked popularity counter reset batch. */
async function deleteLearningPopularityCountersBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "learningPopularityCounters");
}

/** Deletes one generated learning plan item reset batch. */
async function deleteLearningPlanItemsBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "learningPlanItems");
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
    contentAnalyticsPartitions: await ctx.db
      .query("contentAnalyticsPartitions")
      .collect(),
    learningEngagementQueue: await ctx.db
      .query("learningEngagementQueue")
      .collect(),
    learningPopularityCounters: await ctx.db
      .query("learningPopularityCounters")
      .collect(),
    learningPopularitySignals: await ctx.db
      .query("learningPopularitySignals")
      .collect(),
    learningPopularityViewerSignals: await ctx.db
      .query("learningPopularityViewerSignals")
      .collect(),
    learningViews: await ctx.db.query("learningViews").collect(),
    learningPlanItems: await ctx.db.query("learningPlanItems").collect(),
    learningProgramSources: await ctx.db
      .query("learningProgramSources")
      .collect(),
    learningPrograms: await ctx.db.query("learningPrograms").collect(),
    publicRoutes: await ctx.db.query("publicRoutes").collect(),
    routes: await ctx.db.query("contentRoutes").collect(),
    surahs: await ctx.db.query("quranSurahs").collect(),
    userLearningRecents: await ctx.db.query("userLearningRecents").collect(),
    verses: await ctx.db.query("quranVerses").collect(),
  };
}

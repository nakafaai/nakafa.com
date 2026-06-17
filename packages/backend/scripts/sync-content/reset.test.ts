import { internal } from "@repo/backend/convex/_generated/api";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex";
import { getContentCounts } from "@repo/backend/scripts/sync-content/counts";
import { log, logSuccess } from "@repo/backend/scripts/sync-content/logging";
import { reset } from "@repo/backend/scripts/sync-content/reset";
import type { ContentCountsSchema } from "@repo/backend/scripts/sync-content/schemas";
import { getFunctionName } from "convex/server";
import { Effect, type Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/backend/scripts/sync-content/counts", () => ({
  getContentCounts: vi.fn(),
}));

vi.mock("@repo/backend/scripts/sync-content/convex", () => ({
  callConvexMutation: vi.fn(() =>
    Effect.succeed({ deleted: 0, hasMore: false })
  ),
}));

vi.mock("@repo/backend/scripts/sync-content/logging", () => ({
  formatDuration: vi.fn(() => "1ms"),
  log: vi.fn(),
  logSuccess: vi.fn(),
  logWarning: vi.fn(),
}));

vi.mock("@repo/backend/scripts/sync-content/runtime", () => ({
  clearSyncState: vi.fn(() => Effect.void),
}));

const config = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

const emptyCounts = {
  articleReferences: 0,
  articles: 0,
  audioContentSources: 0,
  audioGenerationQueue: 0,
  authors: 0,
  contentAnalyticsPartitions: 0,
  contentAuthors: 0,
  contentAudios: 0,
  contentRouteCounts: 0,
  contentRoutePages: 0,
  contentRoutes: 0,
  publicRoutes: 0,
  contentSearch: 0,
  contentViewAnalyticsQueue: 0,
  contentViews: 0,
  learningProgramCoverage: 0,
  learningPlanItems: 0,
  learningProgramSources: 0,
  learningPrograms: 0,
  learningPopularity: 0,
  exerciseAnswers: 0,
  exerciseAttempts: 0,
  exerciseChoices: 0,
  exerciseItemParameters: 0,
  exerciseQuestions: 0,
  exerciseSets: 0,
  irtCalibrationAttempts: 0,
  irtCalibrationCacheStats: 0,
  irtCalibrationQueue: 0,
  irtCalibrationRuns: 0,
  irtScalePublicationQueue: 0,
  irtScaleQualityChecks: 0,
  irtScaleQualityRefreshQueue: 0,
  irtScaleVersionItems: 0,
  irtScaleVersions: 0,
  assessmentNodes: 0,
  assessments: 0,
  curricula: 0,
  curriculumMaterials: 0,
  curriculumNodes: 0,
  quranSurahs: 0,
  quranVerses: 0,
  materialLocales: 0,
  materials: 0,
  curriculumLessons: 0,
  learningTrendingBuckets: 0,
  curriculumTopics: 0,
  tryoutAccessCampaignProducts: 0,
  tryoutAccessCampaigns: 0,
  tryoutAccessGrants: 0,
  tryoutAccessLinks: 0,
  tryoutAttempts: 0,
  tryoutCatalogMeta: 0,
  tryoutLeaderboardEntries: 0,
  tryoutPartAttempts: 0,
  tryoutPartSets: 0,
  tryouts: 0,
  userTryoutEntitlements: 0,
  userTryoutStats: 0,
} satisfies Schema.Schema.Type<typeof ContentCountsSchema>;

describe("sync-content reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(callConvexMutation).mockReturnValue(
      Effect.succeed({ deleted: 0, hasMore: false })
    );
  });

  it("does not treat contentSearch-only data as an empty database", async () => {
    vi.mocked(getContentCounts).mockReturnValue(
      Effect.succeed({ ...emptyCounts, contentSearch: 1 })
    );

    await Effect.runPromise(reset(config, { force: false }));

    expect(log).toHaveBeenCalledWith("  Content Search:        1");
    expect(log).toHaveBeenCalledWith("  Total derived items:  1");
    expect(log).toHaveBeenCalledWith("\nTo delete all content, run:");
    expect(logSuccess).not.toHaveBeenCalled();
  });

  it("does not treat route and Quran runtime data as an empty database", async () => {
    vi.mocked(getContentCounts).mockReturnValue(
      Effect.succeed({
        ...emptyCounts,
        contentRouteCounts: 1,
        contentRoutePages: 2,
        contentRoutes: 1,
        quranSurahs: 1,
        quranVerses: 7,
      })
    );

    await Effect.runPromise(reset(config, { force: false }));

    expect(log).toHaveBeenCalledWith("  Content Routes:        1");
    expect(log).toHaveBeenCalledWith("  Content Route Counts:  1");
    expect(log).toHaveBeenCalledWith("  Content Route Pages:   2");
    expect(log).toHaveBeenCalledWith("  Quran Surahs:          1");
    expect(log).toHaveBeenCalledWith("  Quran Verses:          7");
    expect(log).toHaveBeenCalledWith("  Total derived items:  12");
    expect(log).toHaveBeenCalledWith("\nTo delete all content, run:");
    expect(logSuccess).not.toHaveBeenCalled();
  });

  it("does not treat program coverage rows as an empty database", async () => {
    vi.mocked(getContentCounts).mockReturnValue(
      Effect.succeed({ ...emptyCounts, learningProgramCoverage: 2 })
    );

    await Effect.runPromise(reset(config, { force: false }));

    expect(log).toHaveBeenCalledWith("  Learning Program Cov:  2");
    expect(log).toHaveBeenCalledWith("  Total derived items:  2");
    expect(log).toHaveBeenCalledWith("\nTo delete all content, run:");
    expect(logSuccess).not.toHaveBeenCalled();
  });

  it("does not treat generated learning plan items as an empty database", async () => {
    vi.mocked(getContentCounts).mockReturnValue(
      Effect.succeed({ ...emptyCounts, learningPlanItems: 3 })
    );

    await Effect.runPromise(reset(config, { force: false }));

    expect(log).toHaveBeenCalledWith("  Learning Plan Items:   3");
    expect(log).toHaveBeenCalledWith("  Total derived items:  3");
    expect(log).toHaveBeenCalledWith("\nTo delete all content, run:");
    expect(logSuccess).not.toHaveBeenCalled();
  });

  it("keeps the empty shortcut when every reset-managed count is zero", async () => {
    vi.mocked(getContentCounts).mockReturnValue(Effect.succeed(emptyCounts));

    await Effect.runPromise(reset(config, { force: false }));

    expect(log).toHaveBeenCalledWith("  Content Search:        0");
    expect(log).toHaveBeenCalledWith("  Content Routes:        0");
    expect(log).toHaveBeenCalledWith("  Content Route Counts:  0");
    expect(log).toHaveBeenCalledWith("  Content Route Pages:   0");
    expect(log).toHaveBeenCalledWith("  Quran Surahs:          0");
    expect(log).toHaveBeenCalledWith("  Quran Verses:          0");
    expect(log).toHaveBeenCalledWith("  Total derived items:  0");
    expect(logSuccess).toHaveBeenCalledWith(
      "\nReset-managed content is already empty. Nothing to delete."
    );
    expect(log).not.toHaveBeenCalledWith("\nTo delete all content, run:");
  });

  it("preserves selected program catalog rows when reset-managed content is empty", async () => {
    vi.mocked(getContentCounts).mockReturnValue(
      Effect.succeed({
        ...emptyCounts,
        learningProgramSources: 5,
        learningPrograms: 4,
      })
    );

    await Effect.runPromise(reset(config, { force: false }));

    expect(log).toHaveBeenCalledWith("  Learning Programs:     4");
    expect(log).toHaveBeenCalledWith("  Learning Program Srcs: 5");
    expect(log).toHaveBeenCalledWith("  Total derived items:  0");
    expect(log).toHaveBeenCalledWith("  Total preserved items: 9");
    expect(logSuccess).toHaveBeenCalledWith(
      "\nReset-managed content is already empty. Nothing to delete."
    );
    expect(log).not.toHaveBeenCalledWith("\nTo delete all content, run:");
  });

  it("deletes generated plan items before program coverage during forced reset", async () => {
    vi.mocked(getContentCounts).mockReturnValue(
      Effect.succeed({
        ...emptyCounts,
        learningPlanItems: 3,
        learningProgramCoverage: 2,
      })
    );

    await Effect.runPromise(reset(config, { force: true }));

    const mutations = vi
      .mocked(callConvexMutation)
      .mock.calls.map(([, mutation]) => getFunctionName(mutation));
    const planItemsIndex = mutations.indexOf(
      getFunctionName(
        internal.contentSync.reset.internal.deleteLearningPlanItemsBatch
      )
    );
    const coverageIndex = mutations.indexOf(
      getFunctionName(
        internal.contentSync.reset.internal.deleteLearningProgramCoverageBatch
      )
    );

    expect(planItemsIndex).toBeGreaterThanOrEqual(0);
    expect(coverageIndex).toBeGreaterThan(planItemsIndex);
  });

  it("deletes final generated read models during forced reset", async () => {
    vi.mocked(getContentCounts).mockReturnValue(
      Effect.succeed({
        ...emptyCounts,
        assessmentNodes: 1,
        assessments: 1,
        curricula: 1,
        curriculumMaterials: 1,
        curriculumNodes: 1,
        materialLocales: 1,
        materials: 1,
      })
    );

    await Effect.runPromise(reset(config, { force: true }));

    const mutations = vi
      .mocked(callConvexMutation)
      .mock.calls.map(([, mutation]) => getFunctionName(mutation));

    expect(mutations).toContain(
      getFunctionName(internal.contentSync.reset.internal.deleteMaterialsBatch)
    );
    expect(mutations).toContain(
      getFunctionName(
        internal.contentSync.reset.internal.deleteMaterialLocalesBatch
      )
    );
    expect(mutations).toContain(
      getFunctionName(internal.contentSync.reset.internal.deleteCurriculaBatch)
    );
    expect(mutations).toContain(
      getFunctionName(
        internal.contentSync.reset.internal.deleteCurriculumNodesBatch
      )
    );
    expect(mutations).toContain(
      getFunctionName(
        internal.contentSync.reset.internal.deleteCurriculumMaterialsBatch
      )
    );
    expect(mutations).toContain(
      getFunctionName(
        internal.contentSync.reset.internal.deleteAssessmentsBatch
      )
    );
    expect(mutations).toContain(
      getFunctionName(
        internal.contentSync.reset.internal.deleteAssessmentNodesBatch
      )
    );
  });

  it("does not delete selected program catalog rows during forced reset", async () => {
    vi.mocked(getContentCounts).mockReturnValue(
      Effect.succeed({
        ...emptyCounts,
        learningProgramCoverage: 1,
        learningProgramSources: 1,
        learningPrograms: 1,
      })
    );

    await Effect.runPromise(reset(config, { force: true }));

    const mutations = vi
      .mocked(callConvexMutation)
      .mock.calls.map(([, mutation]) => getFunctionName(mutation));

    expect(mutations).toContain(
      getFunctionName(
        internal.contentSync.reset.internal.deleteLearningProgramCoverageBatch
      )
    );
    expect(
      mutations.filter(
        (mutation) =>
          mutation.includes("learningProgram") && !mutation.includes("Coverage")
      )
    ).toEqual([]);
  });
});

import { getContentCounts } from "@repo/backend/scripts/sync-content/counts";
import { log, logSuccess } from "@repo/backend/scripts/sync-content/logging";
import { reset } from "@repo/backend/scripts/sync-content/reset";
import type { ContentCountsSchema } from "@repo/backend/scripts/sync-content/schemas";
import { Effect, type Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/backend/scripts/sync-content/counts", () => ({
  getContentCounts: vi.fn(),
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
  articlePopularity: 0,
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
  contentSearch: 0,
  contentViewAnalyticsQueue: 0,
  contentViews: 0,
  exerciseAnswers: 0,
  exerciseAttempts: 0,
  exerciseChoices: 0,
  exerciseItemParameters: 0,
  exercisePopularity: 0,
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
  quranSurahs: 0,
  quranVerses: 0,
  subjectSections: 0,
  subjectPopularity: 0,
  subjectTrendingBuckets: 0,
  subjectTopics: 0,
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
      "\nDatabase is already empty. Nothing to delete."
    );
    expect(log).not.toHaveBeenCalledWith("\nTo delete all content, run:");
  });
});

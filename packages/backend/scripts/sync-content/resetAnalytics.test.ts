import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex";
import { getContentCounts } from "@repo/backend/scripts/sync-content/counts";
import { log, logSuccess } from "@repo/backend/scripts/sync-content/logging";
import { resetAnalytics } from "@repo/backend/scripts/sync-content/resetAnalytics";
import type { ContentCountsSchema } from "@repo/backend/scripts/sync-content/schemas";
import { Effect, type Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/backend/scripts/sync-content/convex", () => ({
  callConvexMutation: vi.fn(),
}));

vi.mock("@repo/backend/scripts/sync-content/counts", () => ({
  getContentCounts: vi.fn(),
}));

vi.mock("@repo/backend/scripts/sync-content/logging", () => ({
  formatDuration: vi.fn(() => "1ms"),
  log: vi.fn(),
  logSuccess: vi.fn(),
  logWarning: vi.fn(),
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
  quranSurahs: 0,
  quranVerses: 0,
  assessmentNodes: 0,
  assessments: 0,
  curricula: 0,
  curriculumMaterials: 0,
  curriculumNodes: 0,
  materialLocales: 0,
  materials: 0,
  curriculumLessons: 0,
  curriculumTopics: 0,
  learningTrendingBuckets: 0,
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

describe("sync-content resetAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("points production dry runs at the analytics-only reset command", async () => {
    vi.mocked(getContentCounts).mockReturnValue(
      Effect.succeed({ ...emptyCounts, contentViews: 20_000 })
    );

    await Effect.runPromise(resetAnalytics(config, { prod: true }));

    expect(log).toHaveBeenCalledWith("  Content Views:        20000");
    expect(log).toHaveBeenCalledWith(
      "\nTo delete content analytics rows, run:"
    );
    expect(log).toHaveBeenCalledWith(
      "  pnpm --filter @repo/backend sync:prod:reset:analytics --force"
    );
    expect(callConvexMutation).not.toHaveBeenCalled();
  });

  it("deletes only the bounded analytics reset batches when forced", async () => {
    vi.mocked(getContentCounts).mockReturnValue(
      Effect.succeed({
        ...emptyCounts,
        learningPopularity: 1,
        contentAnalyticsPartitions: 1,
        contentViewAnalyticsQueue: 1,
        contentViews: 2,
        learningTrendingBuckets: 1,
      })
    );
    vi.mocked(callConvexMutation)
      .mockReturnValueOnce(Effect.succeed({ deleted: 1, hasMore: false }))
      .mockReturnValueOnce(Effect.succeed({ deleted: 1, hasMore: false }))
      .mockReturnValueOnce(Effect.succeed({ deleted: 2, hasMore: false }))
      .mockReturnValueOnce(Effect.succeed({ deleted: 1, hasMore: false }))
      .mockReturnValueOnce(Effect.succeed({ deleted: 1, hasMore: false }));

    await Effect.runPromise(resetAnalytics(config, { force: true }));

    expect(callConvexMutation).toHaveBeenCalledTimes(5);
    expect(logSuccess).toHaveBeenCalledWith(
      "  Deleted 1 content view analytics queue rows"
    );
    expect(logSuccess).toHaveBeenCalledWith(
      "  Deleted 1 content analytics partition leases"
    );
    expect(logSuccess).toHaveBeenCalledWith("  Deleted 2 content view rows");
    expect(logSuccess).toHaveBeenCalledWith(
      "  Deleted 1 learning popularity rows"
    );
    expect(logSuccess).toHaveBeenCalledWith(
      "  Deleted 1 learning trending bucket rows"
    );
    expect(logSuccess).toHaveBeenCalledWith(
      "Deleted 6 analytics rows across content tables"
    );
  });
});

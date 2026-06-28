import { resetAnalytics } from "@repo/backend/scripts/sync-content/cleanup/analytics";
import {
  log,
  logSuccess,
} from "@repo/backend/scripts/sync-content/cli/logging";
import type { ContentCountsSchema } from "@repo/backend/scripts/sync-content/contract/schemas";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex/client";
import { getContentCounts } from "@repo/backend/scripts/sync-content/convex/counts";
import { Effect, type Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/backend/scripts/sync-content/convex/client", () => ({
  callConvexMutation: vi.fn(),
}));

vi.mock("@repo/backend/scripts/sync-content/convex/counts", () => ({
  getContentCounts: vi.fn(),
}));

vi.mock("@repo/backend/scripts/sync-content/cli/logging", () => ({
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
  learningEngagementQueue: 0,
  learningViews: 0,
  learningProgramCoverage: 0,
  learningPlanItems: 0,
  learningProgramSources: 0,
  learningPrograms: 0,
  learningPopularityCounters: 0,
  learningPopularitySignals: 0,
  learningPopularityViewerSignals: 0,
  userLearningRecents: 0,
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
      Effect.succeed({ ...emptyCounts, learningViews: 20_000 })
    );

    await Effect.runPromise(resetAnalytics(config, { prod: true }));

    expect(log).toHaveBeenCalledWith("  Learning Views:       20000");
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
        contentAnalyticsPartitions: 1,
        learningEngagementQueue: 1,
        learningPopularityCounters: 1,
        learningPopularitySignals: 1,
        learningPopularityViewerSignals: 1,
        learningViews: 2,
        userLearningRecents: 1,
      })
    );
    vi.mocked(callConvexMutation)
      .mockReturnValueOnce(Effect.succeed({ deleted: 1, hasMore: false }))
      .mockReturnValueOnce(Effect.succeed({ deleted: 1, hasMore: false }))
      .mockReturnValueOnce(Effect.succeed({ deleted: 2, hasMore: false }))
      .mockReturnValueOnce(Effect.succeed({ deleted: 1, hasMore: false }))
      .mockReturnValueOnce(Effect.succeed({ deleted: 1, hasMore: false }))
      .mockReturnValueOnce(Effect.succeed({ deleted: 1, hasMore: false }))
      .mockReturnValueOnce(Effect.succeed({ deleted: 1, hasMore: false }));

    await Effect.runPromise(resetAnalytics(config, { force: true }));

    expect(callConvexMutation).toHaveBeenCalledTimes(7);
    expect(logSuccess).toHaveBeenCalledWith(
      "  Deleted 1 learning engagement queue rows"
    );
    expect(logSuccess).toHaveBeenCalledWith(
      "  Deleted 1 content analytics partition leases"
    );
    expect(logSuccess).toHaveBeenCalledWith("  Deleted 2 learning view rows");
    expect(logSuccess).toHaveBeenCalledWith(
      "  Deleted 1 user learning recents rows"
    );
    expect(logSuccess).toHaveBeenCalledWith(
      "  Deleted 1 learning popularity signal rows"
    );
    expect(logSuccess).toHaveBeenCalledWith(
      "  Deleted 1 learning popularity viewer signal rows"
    );
    expect(logSuccess).toHaveBeenCalledWith(
      "  Deleted 1 learning popularity counter rows"
    );
    expect(logSuccess).toHaveBeenCalledWith(
      "Deleted 8 analytics rows across content tables"
    );
  });
});

import { resetAudio } from "@repo/backend/scripts/sync-content/cleanup/audio";
import {
  log,
  logSuccess,
} from "@repo/backend/scripts/sync-content/cli/logging";
import type { ContentCountsSchema } from "@repo/backend/scripts/sync-content/contract/inspection";
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

vi.mock("@repo/backend/scripts/sync-content/runtime/files", () => ({
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
  irtCalibrationAttempts: 0,
  irtCalibrationCacheStats: 0,
  irtCalibrationQueue: 0,
  irtCalibrationRuns: 0,
  irtScaleItems: 0,
  irtScalePublicationQueue: 0,
  irtScaleQualityChecks: 0,
  irtScaleQualityRefreshQueue: 0,
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
  questionChoices: 0,
  questions: 0,
  questionSets: 0,
  curriculumLessons: 0,
  curriculumTopics: 0,
  tryoutAccessCampaigns: 0,
  tryoutAccessGrants: 0,
  tryoutAccessLinks: 0,
  tryoutAccessTargets: 0,
  tryoutAttemptPlacements: 0,
  tryoutAttempts: 0,
  tryoutLeaderboardEntries: 0,
  tryoutLeaderboardScopes: 0,
  tryoutLeaderboardUserStats: 0,
  tryoutCountries: 0,
  tryoutExams: 0,
  tryoutTracks: 0,
  tryoutResponses: 0,
  tryoutScores: 0,
  tryoutSectionAttempts: 0,
  tryoutSections: 0,
  tryoutSets: 0,
  tryoutEntitlements: 0,
} satisfies Schema.Schema.Type<typeof ContentCountsSchema>;

describe("sync-content resetAudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("points production dry runs at the audio-only reset command", async () => {
    vi.mocked(getContentCounts).mockReturnValue(
      Effect.succeed({ ...emptyCounts, audioContentSources: 780 })
    );

    await Effect.runPromise(resetAudio(config, { prod: true }));

    expect(log).toHaveBeenCalledWith("  Audio Content Sources: 780");
    expect(log).toHaveBeenCalledWith("\nTo delete audio read models, run:");
    expect(log).toHaveBeenCalledWith(
      "  pnpm --filter @repo/backend sync:prod:reset:audio --force"
    );
    expect(callConvexMutation).not.toHaveBeenCalled();
  });

  it("deletes only the bounded audio reset batches when forced", async () => {
    vi.mocked(getContentCounts).mockReturnValue(
      Effect.succeed({
        ...emptyCounts,
        audioContentSources: 2,
        audioGenerationQueue: 1,
        contentAudios: 1,
      })
    );
    vi.mocked(callConvexMutation)
      .mockReturnValueOnce(Effect.succeed({ deleted: 1, hasMore: false }))
      .mockReturnValueOnce(Effect.succeed({ deleted: 1, hasMore: false }))
      .mockReturnValueOnce(Effect.succeed({ deleted: 2, hasMore: false }));

    await Effect.runPromise(resetAudio(config, { force: true }));

    expect(callConvexMutation).toHaveBeenCalledTimes(3);
    expect(logSuccess).toHaveBeenCalledWith(
      "  Deleted 1 audio generation queue entries"
    );
    expect(logSuccess).toHaveBeenCalledWith(
      "  Deleted 1 generated content audio rows"
    );
    expect(logSuccess).toHaveBeenCalledWith(
      "  Deleted 2 audio content sources"
    );
    expect(logSuccess).toHaveBeenCalledWith(
      "Deleted 4 audio rows across sync-managed tables"
    );
    expect(log).toHaveBeenCalledWith("  pnpm --filter @repo/backend sync");
  });
});

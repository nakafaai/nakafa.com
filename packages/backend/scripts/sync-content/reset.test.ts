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
  articles: 0,
  audioContentSources: 0,
  audioGenerationQueue: 0,
  authors: 0,
  contentAuthors: 0,
  contentAudios: 0,
  contentSearch: 0,
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
  subjectSections: 0,
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

  it("keeps the empty shortcut when every reset-managed count is zero", async () => {
    vi.mocked(getContentCounts).mockReturnValue(Effect.succeed(emptyCounts));

    await Effect.runPromise(reset(config, { force: false }));

    expect(log).toHaveBeenCalledWith("  Content Search:        0");
    expect(log).toHaveBeenCalledWith("  Total derived items:  0");
    expect(logSuccess).toHaveBeenCalledWith(
      "\nDatabase is already empty. Nothing to delete."
    );
    expect(log).not.toHaveBeenCalledWith("\nTo delete all content, run:");
  });
});

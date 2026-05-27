import { callConvex } from "@repo/backend/scripts/sync-content/convex";
import { getContentCounts } from "@repo/backend/scripts/sync-content/counts";
import {
  log,
  logSuccess,
  logWarning,
} from "@repo/backend/scripts/sync-content/logging";
import { reset } from "@repo/backend/scripts/sync-content/reset";
import { clearSyncState } from "@repo/backend/scripts/sync-content/runtime";
import type { ContentCountsSchema } from "@repo/backend/scripts/sync-content/schemas";
import { Effect, type Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/backend/scripts/sync-content/counts", () => ({
  getContentCounts: vi.fn(),
}));

vi.mock("@repo/backend/scripts/sync-content/convex", () => ({
  callConvex: vi.fn(),
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
  authors: 0,
  contentAuthors: 0,
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

  it("prints the production force command during production dry runs", async () => {
    vi.mocked(getContentCounts).mockReturnValue(
      Effect.succeed({ ...emptyCounts, articles: 1 })
    );

    await Effect.runPromise(
      reset(config, { authors: true, force: false, prod: true })
    );

    expect(logWarning).toHaveBeenCalledWith("PRODUCTION DATABASE SELECTED!");
    expect(log).toHaveBeenCalledWith(
      "  pnpm --filter @repo/backend sync:reset --prod --force"
    );
    expect(log).not.toHaveBeenCalledWith(
      "\nTo also delete authors, add --authors flag"
    );
  });

  it("deletes all reset-managed rows and clears non-production sync state", async () => {
    vi.mocked(getContentCounts).mockReturnValue(
      Effect.succeed({ ...emptyCounts, articles: 1 })
    );
    vi.mocked(callConvex)
      .mockReturnValueOnce(Effect.succeed({ deleted: 2, hasMore: true }))
      .mockReturnValueOnce(Effect.succeed({ deleted: 3, hasMore: false }))
      .mockReturnValue(Effect.succeed({ deleted: 0, hasMore: false }));
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await Effect.runPromise(reset(config, { force: true }));

    expect(callConvex).toHaveBeenCalled();
    expect(process.stdout.write).toHaveBeenCalledWith(
      "\r  Batch 1: deleted 2 content search rows..."
    );
    expect(process.stdout.write).toHaveBeenCalledWith(
      "\r  Batch 2: deleted 5 content search rows..."
    );
    expect(process.stdout.write).toHaveBeenCalledWith("\n");
    expect(logSuccess).toHaveBeenCalledWith("  Deleted 5 content search rows");
    expect(log).toHaveBeenCalledWith(
      "Skipping authors (use --authors to include)"
    );
    expect(clearSyncState).toHaveBeenCalledWith(false);
    expect(log).toHaveBeenCalledWith("  pnpm --filter @repo/backend sync");
  });

  it("deletes authors and clears production sync state when explicitly requested", async () => {
    vi.mocked(getContentCounts).mockReturnValue(
      Effect.succeed({ ...emptyCounts, articles: 1, authors: 1 })
    );
    vi.mocked(callConvex).mockReturnValue(
      Effect.succeed({ deleted: 1, hasMore: false })
    );
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await Effect.runPromise(
      reset(config, { authors: true, force: true, prod: true })
    );

    expect(log).toHaveBeenCalledWith("Deleting authors...");
    expect(logSuccess).toHaveBeenCalledWith("  Deleted 1 authors");
    expect(clearSyncState).toHaveBeenCalledWith(true);
    expect(log).toHaveBeenCalledWith("  pnpm --filter @repo/backend sync:prod");
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

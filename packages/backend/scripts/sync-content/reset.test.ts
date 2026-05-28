import { beforeEach, describe, expect, it, vi } from "@effect/vitest";
import type { ContentCountsSchema } from "@repo/backend/scripts/sync-content/schemas";
import { Effect, type Schema } from "effect";

const callConvexMock = vi.fn();
const clearSyncStateMock = vi.fn(() => Effect.void);
const getContentCountsMock = vi.fn();
const logMock = vi.fn();
const logSuccessMock = vi.fn();
const logWarningMock = vi.fn();

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

/** Loads the reset module after installing per-test module adapters. */
const loadReset = Effect.fn("resetTest.loadReset")(function* () {
  return yield* Effect.promise(
    () => import("@repo/backend/scripts/sync-content/reset")
  );
});

describe("sync-content reset", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.clearAllMocks();

    vi.doMock("@repo/backend/scripts/sync-content/counts", () => ({
      getContentCounts: getContentCountsMock,
    }));
    vi.doMock("@repo/backend/scripts/sync-content/convex", () => ({
      callConvex: callConvexMock,
    }));
    vi.doMock("@repo/backend/scripts/sync-content/logging", () => ({
      formatDuration: vi.fn(() => "1ms"),
      log: logMock,
      logSuccess: logSuccessMock,
      logWarning: logWarningMock,
    }));
    vi.doMock("@repo/backend/scripts/sync-content/runtime", () => ({
      clearSyncState: clearSyncStateMock,
    }));
  });

  it.effect("does not treat contentSearch-only data as an empty database", () =>
    Effect.gen(function* () {
      getContentCountsMock.mockReturnValue(
        Effect.succeed({ ...emptyCounts, contentSearch: 1 })
      );

      const { reset } = yield* loadReset();

      yield* reset(config, { force: false });

      expect(logMock).toHaveBeenCalledWith("  Content Search:        1");
      expect(logMock).toHaveBeenCalledWith("  Total derived items:  1");
      expect(logMock).toHaveBeenCalledWith("\nTo delete all content, run:");
      expect(logSuccessMock).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "prints the production force command during production dry runs",
    () =>
      Effect.gen(function* () {
        getContentCountsMock.mockReturnValue(
          Effect.succeed({ ...emptyCounts, articles: 1 })
        );

        const { reset } = yield* loadReset();

        yield* reset(config, { authors: true, force: false, prod: true });

        expect(logWarningMock).toHaveBeenCalledWith(
          "PRODUCTION DATABASE SELECTED!"
        );
        expect(logMock).toHaveBeenCalledWith(
          "  pnpm --filter @repo/backend sync:reset --prod --force"
        );
        expect(logMock).not.toHaveBeenCalledWith(
          "\nTo also delete authors, add --authors flag"
        );
      })
  );

  it.effect("deletes all reset-managed rows and clears dev sync state", () =>
    Effect.gen(function* () {
      getContentCountsMock.mockReturnValue(
        Effect.succeed({ ...emptyCounts, articles: 1 })
      );
      callConvexMock
        .mockReturnValueOnce(Effect.succeed({ deleted: 2, hasMore: true }))
        .mockReturnValueOnce(Effect.succeed({ deleted: 3, hasMore: false }))
        .mockReturnValue(Effect.succeed({ deleted: 0, hasMore: false }));
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);

      const { reset } = yield* loadReset();

      yield* reset(config, { force: true });

      expect(callConvexMock).toHaveBeenCalled();
      expect(process.stdout.write).toHaveBeenCalledWith(
        "\r  Batch 1: deleted 2 content search rows..."
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        "\r  Batch 2: deleted 5 content search rows..."
      );
      expect(process.stdout.write).toHaveBeenCalledWith("\n");
      expect(logSuccessMock).toHaveBeenCalledWith(
        "  Deleted 5 content search rows"
      );
      expect(logMock).toHaveBeenCalledWith(
        "Skipping authors (use --authors to include)"
      );
      expect(clearSyncStateMock).toHaveBeenCalledWith(false);
      expect(logMock).toHaveBeenCalledWith(
        "  pnpm --filter @repo/backend sync"
      );
    })
  );

  it.effect("deletes authors and clears prod sync state when requested", () =>
    Effect.gen(function* () {
      getContentCountsMock.mockReturnValue(
        Effect.succeed({ ...emptyCounts, articles: 1, authors: 1 })
      );
      callConvexMock.mockReturnValue(
        Effect.succeed({ deleted: 1, hasMore: false })
      );
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);

      const { reset } = yield* loadReset();

      yield* reset(config, { authors: true, force: true, prod: true });

      expect(logMock).toHaveBeenCalledWith("Deleting authors...");
      expect(logSuccessMock).toHaveBeenCalledWith("  Deleted 1 authors");
      expect(clearSyncStateMock).toHaveBeenCalledWith(true);
      expect(logMock).toHaveBeenCalledWith(
        "  pnpm --filter @repo/backend sync:prod"
      );
    })
  );

  it.effect("keeps the empty shortcut when every reset count is zero", () =>
    Effect.gen(function* () {
      getContentCountsMock.mockReturnValue(Effect.succeed(emptyCounts));

      const { reset } = yield* loadReset();

      yield* reset(config, { force: false });

      expect(logMock).toHaveBeenCalledWith("  Content Search:        0");
      expect(logMock).toHaveBeenCalledWith("  Total derived items:  0");
      expect(logSuccessMock).toHaveBeenCalledWith(
        "\nDatabase is already empty. Nothing to delete."
      );
      expect(logMock).not.toHaveBeenCalledWith("\nTo delete all content, run:");
    })
  );
});

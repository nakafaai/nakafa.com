import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/contract/types";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

const syncResult: SyncResult = {
  created: 0,
  unchanged: 1,
  updated: 0,
};

/** Loads the CLI with mocked sync dependencies and records command ordering. */
const loadCli = async (options: { learningProgramFails?: boolean } = {}) => {
  const events: string[] = [];
  const invalidatedOptions: SyncOptions[] = [];

  /** Records commands that are not exercised by this focused CLI test. */
  const unusedCommand = () => Effect.void;

  vi.doMock("@repo/backend/scripts/sync-content/content/articles", () => ({
    /** Records article sync calls if a test accidentally reaches them. */
    syncArticles: unusedCommand,
  }));
  vi.doMock("@repo/backend/scripts/sync-content/content/authors", () => ({
    /** Records author sync calls if a test accidentally reaches them. */
    syncAuthors: unusedCommand,
  }));
  vi.doMock("@repo/backend/scripts/sync-content/runtime/cache", () => ({
    /** Records content-runtime invalidation after successful program sync. */
    invalidateContentRuntimeCache: (syncOptions: SyncOptions) => {
      events.push("invalidateContentRuntimeCache");
      invalidatedOptions.push(syncOptions);
      return Effect.void;
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/cleanup/clean", () => ({
    /** Records cleanup calls if a test accidentally reaches them. */
    clean: unusedCommand,
  }));
  vi.doMock("@repo/backend/scripts/sync-content/convex/client", () => ({
    /** Supplies deterministic Convex config without reading environment. */
    getConvexConfig: () => {
      events.push("getConvexConfig");
      return Effect.succeed(config);
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/content/tryouts", () => ({
    /** Records try-out sync calls if a test accidentally reaches them. */
    syncTryouts: unusedCommand,
  }));
  vi.doMock("@repo/backend/scripts/sync-content/content/programs", () => ({
    /** Records targeted learning-program sync calls and optional failures. */
    syncLearningPrograms: () => {
      events.push("syncLearningPrograms");

      if (options.learningProgramFails) {
        return Effect.fail(new Error("learning program sync failed"));
      }

      return Effect.succeed(syncResult);
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/cli/logging", () => ({
    /** Suppresses normal CLI usage logs. */
    log: () => undefined,
    /** Suppresses normal CLI error logs. */
    logError: () => undefined,
  }));
  vi.doMock("@repo/backend/scripts/sync-content/cleanup/reset", () => ({
    /** Records reset calls if a test accidentally reaches them. */
    reset: unusedCommand,
  }));
  vi.doMock("@repo/backend/scripts/sync-content/cleanup/analytics", () => ({
    /** Records analytics reset calls if a test accidentally reaches them. */
    resetAnalytics: unusedCommand,
  }));
  vi.doMock("@repo/backend/scripts/sync-content/cleanup/audio", () => ({
    /** Records audio reset calls if a test accidentally reaches them. */
    resetAudio: unusedCommand,
  }));
  vi.doMock("@repo/backend/scripts/sync-content/cleanup/tryouts", () => ({
    /** Records tryout reset calls if a test accidentally reaches them. */
    resetTryouts: unusedCommand,
  }));
  vi.doMock("@repo/backend/scripts/sync-content/content/curriculum", () => ({
    /** Records curriculum lesson sync calls if a test accidentally reaches them. */
    syncCurriculumLessons: unusedCommand,
    /** Records curriculum topic sync calls if a test accidentally reaches them. */
    syncCurriculumTopics: unusedCommand,
  }));
  vi.doMock("@repo/backend/scripts/sync-content/content/validate", () => ({
    /** Records validation calls if a test accidentally reaches them. */
    validate: unusedCommand,
  }));
  vi.doMock("@repo/backend/scripts/sync-content/verify/sync", () => ({
    /** Records verification calls if a test accidentally reaches them. */
    verify: unusedCommand,
  }));
  vi.doMock("@repo/backend/scripts/sync-content/workflow/full", () => ({
    /** Records full sync calls if a test accidentally reaches them. */
    syncFull: unusedCommand,
  }));
  vi.doMock("@repo/backend/scripts/sync-content/workflow/run", () => ({
    /** Records full all-content sync calls if a test accidentally reaches them. */
    syncAll: unusedCommand,
    /** Records incremental sync calls if a test accidentally reaches them. */
    syncIncremental: unusedCommand,
  }));

  const cli = await import("@repo/backend/scripts/sync-content/cli/command");

  return { cli, events, invalidatedOptions };
};

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("sync-content cli", () => {
  it("invalidates content runtime cache after targeted learning-program sync", async () => {
    const { cli, events, invalidatedOptions } = await loadCli();
    const options: SyncOptions = { locale: "id" };

    await Effect.runPromise(cli.runCommand("learning-programs", options));

    expect(events).toEqual([
      "getConvexConfig",
      "syncLearningPrograms",
      "invalidateContentRuntimeCache",
    ]);
    expect(invalidatedOptions).toEqual([options]);
  });

  it("does not invalidate content runtime cache when targeted learning-program sync fails", async () => {
    const { cli, events } = await loadCli({ learningProgramFails: true });

    await expect(
      Effect.runPromise(cli.runCommand("learning-programs", {}))
    ).rejects.toThrow("learning program sync failed");

    expect(events).toEqual(["getConvexConfig", "syncLearningPrograms"]);
  });
});

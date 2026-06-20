import type {
  ConvexConfig,
  SyncMetrics,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/types";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

interface CleanResult {
  deleted: number;
  hasStale: boolean;
}

interface WorkflowMockOptions {
  changedFiles?: string[];
  syncState?: {
    lastSyncCommit: string;
    lastSyncTimestamp: number;
  } | null;
  verifyFails?: boolean;
}

/** Creates the neutral sync result used by workflow dependency mocks. */
const createSyncResult = (): SyncResult => ({
  created: 0,
  unchanged: 0,
  updated: 0,
});

/** Registers workflow dependency mocks and returns the recorded call events. */
const loadWorkflow = async (
  cleanResult: CleanResult,
  options: WorkflowMockOptions = {}
) => {
  const events: string[] = [];
  const learningProgramOptions: SyncOptions[] = [];
  const routePageOptions: SyncOptions[] = [];
  const syncState = options.syncState ?? null;
  const changedFiles = new Set(options.changedFiles ?? []);

  /** Records one workflow dependency event and returns a successful sync result. */
  const syncStep = (name: string) => {
    events.push(name);
    return Effect.succeed(createSyncResult());
  };

  vi.doMock("@repo/backend/scripts/sync-content/articles", () => ({
    /** Records article sync calls. */
    syncArticles: () => syncStep("syncArticles"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/authors", () => ({
    /** Records author discovery calls. */
    collectAuthorNamesFromFiles: () => Effect.succeed([]),
    /** Records author sync calls. */
    syncAuthors: () => {
      events.push("syncAuthors");
      return Effect.succeed({ created: 0, existing: 0 });
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/clean", () => ({
    /** Records full-sync cleanup calls. */
    clean: () => {
      events.push("clean");
      return Effect.succeed(cleanResult);
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/cache", () => ({
    /** Records cache invalidation calls made after runtime read models are refreshed. */
    invalidateContentRuntimeCache: () => {
      events.push("invalidateContentRuntimeCache");
      return Effect.void;
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/convex", () => ({
    /** Fails if direct incremental-only mutation calls are reached by this workflow test. */
    callConvexMutation: () =>
      Effect.fail(new Error("Unexpected Convex mutation call.")),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/exercises", () => ({
    /** Records exercise set sync calls. */
    syncExerciseSets: () => syncStep("syncExerciseSets"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/exerciseQuestions", () => ({
    /** Records exercise question sync calls. */
    syncExerciseQuestions: () => syncStep("syncExerciseQuestions"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/logging", () => ({
    /** Suppresses duration formatting noise in workflow tests. */
    formatDuration: () => "0ms",
    /** Renders sync result counts for logged workflow summaries. */
    formatSyncResult: (result: SyncResult) =>
      `${result.created}/${result.updated}/${result.unchanged}`,
    /** Suppresses normal sync logs. */
    log: () => undefined,
    /** Suppresses error sync logs. */
    logError: () => undefined,
    /** Suppresses success sync logs. */
    logSuccess: () => undefined,
    /** Suppresses performance metric logs. */
    logSyncMetrics: () => undefined,
  }));
  vi.doMock("@repo/backend/scripts/sync-content/metrics", () => ({
    /** Records aggregate phase metrics without wall-clock dependencies. */
    addPhaseMetrics: () => undefined,
    /** Creates a deterministic metrics container. */
    createMetrics: (): SyncMetrics => ({ phases: [], totalStartTime: 0 }),
    /** Completes a mocked phase. */
    endPhase: () => undefined,
    /** Finalizes mocked metrics. */
    finalizeMetrics: () => undefined,
    /** Starts a deterministic mocked phase. */
    startPhase: (_metrics: SyncMetrics, phase: string) => ({
      itemCount: 0,
      phase,
      startTime: 0,
    }),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/quran", () => ({
    /** Records Quran sync calls. */
    syncQuran: () => syncStep("syncQuran"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/routes", () => ({
    /** Records route artifact page sync calls. */
    syncContentRouteArtifactPages: (
      _config: ConvexConfig,
      syncOptions: SyncOptions
    ) => {
      routePageOptions.push(syncOptions);

      return syncStep("syncRoutePages");
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/readModels", () => ({
    /** Records generated material/curriculum/assessment read-model refresh calls. */
    syncGeneratedReadModels: () => syncStep("syncGeneratedReadModels"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/learningPrograms", () => ({
    /** Records learning program catalog and coverage refresh calls. */
    syncLearningPrograms: (_config: ConvexConfig, syncOptions: SyncOptions) => {
      learningProgramOptions.push(syncOptions);

      return syncStep("syncLearningPrograms");
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/runtime", () => ({
    /** Returns deterministic changed files for incremental workflow tests. */
    getChangedFilesSince: () => Effect.succeed(changedFiles),
    /** Returns a deterministic commit for sync-state writes. */
    getCurrentGitCommit: () => Effect.succeed("test-commit"),
    /** Returns deterministic sync state without touching disk. */
    loadSyncState: () => Effect.succeed(syncState),
    /** Records sync-state writes. */
    saveSyncState: () => {
      events.push("saveSyncState");
      return Effect.void;
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/schemas", () => ({
    /** Provides batch sizes for workflow imports not exercised here. */
    BATCH_SIZES: { authors: 100 },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/curriculum", () => ({
    /** Records curriculum lesson sync calls. */
    syncCurriculumLessons: () => syncStep("syncCurriculumLessons"),
    /** Records curriculum topic sync calls. */
    syncCurriculumTopics: () => syncStep("syncCurriculumTopics"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/tryouts", () => ({
    /** Records tryout sync calls. */
    syncTryouts: () => syncStep("syncTryouts"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/verify", () => ({
    /** Records verification calls. */
    verify: () => {
      events.push("verify");
      if (options.verifyFails) {
        return Effect.fail(new Error("verify failed"));
      }

      return Effect.void;
    },
  }));

  const full = await import("@repo/backend/scripts/sync-content/full");
  const workflows = await import(
    "@repo/backend/scripts/sync-content/workflows"
  );

  return {
    events,
    learningProgramOptions,
    routePageOptions,
    workflow: {
      syncFull: full.syncFull,
      syncIncremental: workflows.syncIncremental,
    },
  };
};

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("sync-content workflows", () => {
  it("rebuilds route artifact pages after stale cleanup deletes rows", async () => {
    const { events, workflow } = await loadWorkflow({
      deleted: 3,
      hasStale: true,
    });
    const options: SyncOptions = {};

    await Effect.runPromise(workflow.syncFull(config, options));

    expect(events.filter((event) => event === "syncRoutePages")).toHaveLength(
      2
    );
    expect(
      events.filter((event) => event === "syncLearningPrograms")
    ).toHaveLength(2);
    expect(events).toEqual(
      expect.arrayContaining([
        "syncAuthors",
        "syncRoutePages",
        "syncGeneratedReadModels",
        "syncLearningPrograms",
        "clean",
        "verify",
        "invalidateContentRuntimeCache",
        "saveSyncState",
      ])
    );
    expect(events.indexOf("syncRoutePages")).toBeLessThan(
      events.indexOf("clean")
    );
    expect(events.lastIndexOf("syncRoutePages")).toBeGreaterThan(
      events.indexOf("clean")
    );
    expect(events.lastIndexOf("syncRoutePages")).toBeLessThan(
      events.lastIndexOf("syncGeneratedReadModels")
    );
    expect(events.lastIndexOf("syncGeneratedReadModels")).toBeLessThan(
      events.lastIndexOf("syncLearningPrograms")
    );
    expect(events.lastIndexOf("syncLearningPrograms")).toBeLessThan(
      events.indexOf("verify")
    );
    expect(events.indexOf("verify")).toBeLessThan(
      events.indexOf("invalidateContentRuntimeCache")
    );
    expect(events.indexOf("invalidateContentRuntimeCache")).toBeLessThan(
      events.indexOf("saveSyncState")
    );
  });

  it("rebuilds all route artifact pages after full cleanup deletes rows", async () => {
    const { events, learningProgramOptions, routePageOptions, workflow } =
      await loadWorkflow({
        deleted: 3,
        hasStale: true,
      });
    const options: SyncOptions = { locale: "id" };

    await Effect.runPromise(workflow.syncFull(config, options));

    expect(events.filter((event) => event === "syncRoutePages")).toHaveLength(
      2
    );
    expect(events.lastIndexOf("syncRoutePages")).toBeGreaterThan(
      events.indexOf("clean")
    );
    expect(events.lastIndexOf("syncRoutePages")).toBeLessThan(
      events.lastIndexOf("syncGeneratedReadModels")
    );
    expect(events.lastIndexOf("syncGeneratedReadModels")).toBeLessThan(
      events.indexOf("verify")
    );
    expect(routePageOptions).toHaveLength(2);
    expect(learningProgramOptions).toHaveLength(2);
    expect(routePageOptions[0]?.locale).toBe("id");
    expect(routePageOptions[1]?.locale).toBeUndefined();
    expect(learningProgramOptions[1]?.locale).toBeUndefined();
  });

  it("keeps one route artifact page sync when cleanup finds no deleted rows", async () => {
    const { events, workflow } = await loadWorkflow({
      deleted: 0,
      hasStale: false,
    });
    const options: SyncOptions = {};

    await Effect.runPromise(workflow.syncFull(config, options));

    expect(events.filter((event) => event === "syncRoutePages")).toHaveLength(
      1
    );
    expect(
      events.filter((event) => event === "syncLearningPrograms")
    ).toHaveLength(1);
    expect(events.indexOf("syncRoutePages")).toBeLessThan(
      events.indexOf("syncGeneratedReadModels")
    );
    expect(events.indexOf("syncGeneratedReadModels")).toBeLessThan(
      events.indexOf("syncLearningPrograms")
    );
    expect(events.indexOf("syncLearningPrograms")).toBeLessThan(
      events.indexOf("clean")
    );
    expect(events.indexOf("verify")).toBeGreaterThan(events.indexOf("clean"));
    expect(events.indexOf("invalidateContentRuntimeCache")).toBeGreaterThan(
      events.indexOf("verify")
    );
  });

  it("does not invalidate content runtime cache when full verification fails", async () => {
    const { events, workflow } = await loadWorkflow(
      {
        deleted: 0,
        hasStale: false,
      },
      { verifyFails: true }
    );

    await expect(
      Effect.runPromise(workflow.syncFull(config, {}))
    ).rejects.toThrow("Full sync failed");

    expect(events).toContain("verify");
    expect(events).not.toContain("invalidateContentRuntimeCache");
    expect(events).not.toContain("saveSyncState");
  });

  it("cleans stale incremental content before rebuilding route artifact pages", async () => {
    const { events, workflow } = await loadWorkflow(
      {
        deleted: 3,
        hasStale: true,
      },
      {
        changedFiles: ["packages/contents/articles/politics/deleted.mdx"],
        syncState: {
          lastSyncCommit: "previous-commit",
          lastSyncTimestamp: 1,
        },
      }
    );
    const options: SyncOptions = {};

    await Effect.runPromise(workflow.syncIncremental(config, options));

    expect(events).toEqual(
      expect.arrayContaining([
        "syncArticles",
        "clean",
        "syncQuran",
        "syncRoutePages",
        "syncLearningPrograms",
        "invalidateContentRuntimeCache",
        "saveSyncState",
      ])
    );
    expect(events.indexOf("clean")).toBeGreaterThan(
      events.indexOf("syncArticles")
    );
    expect(events.indexOf("clean")).toBeLessThan(
      events.indexOf("syncRoutePages")
    );
    expect(events.indexOf("syncRoutePages")).toBeLessThan(
      events.indexOf("syncLearningPrograms")
    );
  });

  it("rebuilds all route artifact pages after global incremental cleanup deletes rows", async () => {
    const { events, learningProgramOptions, routePageOptions, workflow } =
      await loadWorkflow(
        {
          deleted: 3,
          hasStale: true,
        },
        {
          changedFiles: ["packages/contents/articles/politics/deleted.mdx"],
          syncState: {
            lastSyncCommit: "previous-commit",
            lastSyncTimestamp: 1,
          },
        }
      );
    const options: SyncOptions = { locale: "id" };

    await Effect.runPromise(workflow.syncIncremental(config, options));

    expect(events).toEqual(
      expect.arrayContaining([
        "clean",
        "syncRoutePages",
        "syncLearningPrograms",
        "invalidateContentRuntimeCache",
        "saveSyncState",
      ])
    );
    expect(routePageOptions).toHaveLength(1);
    expect(learningProgramOptions).toHaveLength(1);
    expect(routePageOptions[0]?.locale).toBeUndefined();
    expect(learningProgramOptions[0]?.locale).toBeUndefined();
  });

  it("refreshes generated read models for projection-only incremental changes", async () => {
    const { events, workflow } = await loadWorkflow(
      {
        deleted: 0,
        hasStale: false,
      },
      {
        changedFiles: ["packages/contents/_types/route/practice/path.ts"],
        syncState: {
          lastSyncCommit: "previous-commit",
          lastSyncTimestamp: 1,
        },
      }
    );
    const options: SyncOptions = {};

    await Effect.runPromise(workflow.syncIncremental(config, options));

    expect(events).toEqual(
      expect.arrayContaining([
        "clean",
        "syncRoutePages",
        "syncGeneratedReadModels",
        "syncLearningPrograms",
        "invalidateContentRuntimeCache",
        "saveSyncState",
      ])
    );
    expect(events).not.toContain("syncExerciseSets");
    expect(events).not.toContain("syncExerciseQuestions");
    expect(events.indexOf("syncRoutePages")).toBeLessThan(
      events.indexOf("syncGeneratedReadModels")
    );
    expect(events.indexOf("syncGeneratedReadModels")).toBeLessThan(
      events.indexOf("syncLearningPrograms")
    );
  });

  it("refreshes runtime read models before saving no-op incremental sync", async () => {
    const { events, workflow } = await loadWorkflow(
      {
        deleted: 0,
        hasStale: false,
      },
      {
        changedFiles: [],
        syncState: {
          lastSyncCommit: "previous-commit",
          lastSyncTimestamp: 1,
        },
      }
    );
    const options: SyncOptions = {};

    await Effect.runPromise(workflow.syncIncremental(config, options));

    expect(events).toEqual([
      "syncQuran",
      "syncRoutePages",
      "syncGeneratedReadModels",
      "syncLearningPrograms",
      "invalidateContentRuntimeCache",
      "saveSyncState",
    ]);
  });
});

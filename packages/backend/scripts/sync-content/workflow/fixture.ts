import { NAKAFA_CONTENT_SECTIONS } from "@repo/backend/convex/contents/constants";
import type { NakafaSection } from "@repo/backend/convex/lib/validators/contents";
import type {
  ConvexConfig,
  SyncMetrics,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/contract/types";
import type { ContentRouteArtifactTarget } from "@repo/backend/scripts/sync-content/routes/artifacts";
import { locales } from "@repo/utilities/locales";
import { Effect } from "effect";
import { vi } from "vitest";

export const workflowTestConfig: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

interface CleanResult {
  deleted: number;
  hasStale: boolean;
}

interface WorkflowMockOptions {
  changedFiles?: string[];
  deletedContentFiles?: string[];
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
export async function loadWorkflow(
  cleanResult: CleanResult,
  options: WorkflowMockOptions = {}
) {
  const events: string[] = [];
  const learningProgramOptions: SyncOptions[] = [];
  const routeArtifactTargets: (readonly ContentRouteArtifactTarget[])[] = [];
  const syncState = options.syncState ?? null;
  const changedFiles = new Set(options.changedFiles ?? []);

  /** Records one workflow dependency event and returns a successful sync result. */
  const syncStep = (name: string) => {
    events.push(name);
    return Effect.succeed(createSyncResult());
  };

  vi.doMock("@repo/backend/scripts/sync-content/content/articles", () => ({
    /** Records article sync calls. */
    syncArticles: () => syncStep("syncArticles"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/content/authors", () => ({
    /** Records author discovery calls. */
    collectAuthorNamesFromFiles: () => Effect.succeed([]),
    /** Records author sync calls. */
    syncAuthors: () => {
      events.push("syncAuthors");
      return Effect.succeed({ created: 0, existing: 0 });
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/cleanup/clean", () => ({
    /** Records full-sync cleanup calls. */
    clean: () => {
      events.push("clean");
      return Effect.succeed(cleanResult);
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/runtime/cache", () => ({
    /** Records cache invalidation calls made after runtime read models are refreshed. */
    invalidateContentRuntimeCache: () => {
      events.push("invalidateContentRuntimeCache");
      return Effect.void;
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/convex/client", () => ({
    /** Fails if direct incremental-only mutation calls are reached by this workflow test. */
    callConvexMutation: () =>
      Effect.fail(new Error("Unexpected Convex mutation call.")),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/cli/logging", () => ({
    /** Suppresses duration formatting noise in workflow tests. */
    formatDuration: () => "0ms",
    /** Renders sync result counts for logged workflow summaries. */
    formatSyncResult: (result: SyncResult) =>
      `${result.created}/${result.updated}/${result.unchanged}`,
    /** Suppresses normal sync logs. */
    log: () => undefined,
    /** Suppresses normal sync error logs. */
    logError: () => undefined,
    /** Suppresses normal sync success logs. */
    logSuccess: () => undefined,
    /** Suppresses performance metric logs. */
    logSyncMetrics: () => undefined,
  }));
  vi.doMock("@repo/backend/scripts/sync-content/workflow/metrics", () => ({
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
  vi.doMock("@repo/backend/scripts/sync-content/content/quran", () => ({
    /** Records Quran sync calls. */
    syncQuran: () => syncStep("syncQuran"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/routes/artifacts", () => ({
    /** Builds deterministic artifact targets for workflow orchestration tests. */
    createContentRouteArtifactTargets: (
      locale?: (typeof locales)[number],
      sections: readonly NakafaSection[] = NAKAFA_CONTENT_SECTIONS
    ) => {
      const targetLocales = locale ? [locale] : locales;

      return sections.flatMap((section) =>
        targetLocales.map((targetLocale) => ({
          locale: targetLocale,
          section,
        }))
      );
    },
    /** Records route artifact page sync calls. */
    syncContentRouteArtifactPages: (
      _config: ConvexConfig,
      targets: readonly ContentRouteArtifactTarget[]
    ) => {
      routeArtifactTargets.push(targets);
      return syncStep("syncRoutePages");
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/routes/sync", () => ({
    /** Records public route refresh calls. */
    syncPublicRoutes: () => syncStep("syncPublicRoutes"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/content/programs", () => ({
    /** Records learning program catalog and coverage refresh calls. */
    syncLearningPrograms: (_config: ConvexConfig, syncOptions: SyncOptions) => {
      learningProgramOptions.push(syncOptions);
      return syncStep("syncLearningPrograms");
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/runtime/files", () => ({
    /** Returns deterministic changed files for incremental workflow tests. */
    getChangedFilesSince: () => Effect.succeed(changedFiles),
    /** Returns deleted paths separately so rename sources remain visible. */
    getDeletedFilesSince: () =>
      Effect.succeed(new Set(options.deletedContentFiles ?? [])),
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
  vi.doMock("@repo/backend/scripts/sync-content/contract/schemas", () => ({
    /** Provides batch sizes for workflow imports not exercised here. */
    BATCH_SIZES: { authors: 100 },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/content/curriculum", () => ({
    /** Records curriculum lesson sync calls. */
    syncCurriculumLessons: () => syncStep("syncCurriculumLessons"),
    /** Records curriculum topic sync calls. */
    syncCurriculumTopics: () => syncStep("syncCurriculumTopics"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/content/tryouts", () => ({
    /** Records try-out sync calls. */
    syncTryouts: () => syncStep("syncTryouts"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/verify/sync", () => ({
    /** Records verification calls. */
    verify: () => {
      events.push("verify");
      if (options.verifyFails) {
        return Effect.fail(new Error("verify failed"));
      }

      return Effect.void;
    },
  }));

  const full = await import("@repo/backend/scripts/sync-content/workflow/full");
  const workflows = await import(
    "@repo/backend/scripts/sync-content/workflow/run"
  );

  return {
    events,
    learningProgramOptions,
    routeArtifactTargets,
    workflow: {
      syncFull: full.syncFull,
      syncIncremental: workflows.syncIncremental,
    },
  };
}

import type { SyncOptions } from "@repo/backend/scripts/sync-content/contract/types";
import {
  loadWorkflow,
  workflowTestConfig,
} from "@repo/backend/scripts/sync-content/workflow/fixture";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const config = workflowTestConfig;

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("sync-content workflows", () => {
  it("cleans stale rows before syncing their replacements", async () => {
    const { events, workflow } = await loadWorkflow({
      deleted: 3,
      hasStale: true,
    });
    const options: SyncOptions = {};

    await Effect.runPromise(workflow.syncFull(config, options));

    expect(events.filter((event) => event === "syncRoutePages")).toHaveLength(
      1
    );
    expect(
      events.filter((event) => event === "syncLearningPrograms")
    ).toHaveLength(1);
    expect(events).toEqual(
      expect.arrayContaining([
        "syncAuthors",
        "syncRoutePages",
        "syncPublicRoutes",
        "syncLearningPrograms",
        "clean",
        "verify",
        "invalidateContentRuntimeCache",
        "saveSyncState",
      ])
    );
    expect(events.indexOf("clean")).toBeLessThan(
      events.indexOf("syncArticles")
    );
    expect(events.indexOf("syncRoutePages")).toBeLessThan(
      events.indexOf("syncPublicRoutes")
    );
    expect(events.indexOf("syncPublicRoutes")).toBeLessThan(
      events.indexOf("syncLearningPrograms")
    );
    expect(events.indexOf("syncLearningPrograms")).toBeLessThan(
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
    const { events, learningProgramOptions, routeArtifactTargets, workflow } =
      await loadWorkflow({
        deleted: 3,
        hasStale: true,
      });
    const options: SyncOptions = { locale: "id" };

    await Effect.runPromise(workflow.syncFull(config, options));

    expect(events.filter((event) => event === "syncRoutePages")).toHaveLength(
      1
    );
    expect(events.indexOf("clean")).toBeLessThan(
      events.indexOf("syncArticles")
    );
    expect(events.indexOf("syncPublicRoutes")).toBeLessThan(
      events.indexOf("verify")
    );
    expect(routeArtifactTargets).toHaveLength(1);
    expect(learningProgramOptions).toHaveLength(1);
    expect(routeArtifactTargets[0]).toHaveLength(8);
    expect(learningProgramOptions[0]?.locale).toBeUndefined();
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

  it("rejects locale-scoped incremental sync before reading or advancing shared state", async () => {
    const { events, workflow } = await loadWorkflow({
      deleted: 0,
      hasStale: false,
    });

    await expect(
      Effect.runPromise(workflow.syncIncremental(config, { locale: "id" }))
    ).rejects.toThrow(
      "Incremental sync does not support --locale because sync state is shared across locales"
    );

    expect(events).toEqual([]);
  });

  it("cleans stale incremental content before rebuilding route artifact pages", async () => {
    const { events, workflow } = await loadWorkflow(
      {
        deleted: 3,
        hasStale: true,
      },
      {
        changedFiles: ["packages/contents/articles/politics/deleted/id.mdx"],
        deletedContentFiles: [
          "packages/contents/articles/politics/deleted/id.mdx",
        ],
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
        "syncRoutePages",
        "invalidateContentRuntimeCache",
        "saveSyncState",
      ])
    );
    expect(events.indexOf("clean")).toBeLessThan(
      events.indexOf("syncArticles")
    );
    expect(events.indexOf("clean")).toBeLessThan(
      events.indexOf("syncRoutePages")
    );
    expect(events).not.toContain("syncQuran");
    expect(events).toContain("syncLearningPrograms");
  });

  it("rebuilds one localized artifact target without a global stale scan", async () => {
    const { events, routeArtifactTargets, workflow } = await loadWorkflow(
      {
        deleted: 0,
        hasStale: false,
      },
      {
        changedFiles: [
          "packages/contents/articles/politics/how-policy-works/id.mdx",
        ],
        syncState: {
          lastSyncCommit: "previous-commit",
          lastSyncTimestamp: 1,
        },
      }
    );

    await Effect.runPromise(workflow.syncIncremental(config, {}));

    expect(events).not.toContain("clean");
    expect(routeArtifactTargets).toEqual([
      [{ locale: "id", section: "articles" }],
    ]);
  });

  it("includes a renamed source's old path in cleanup and affected artifacts", async () => {
    const { events, learningProgramOptions, routeArtifactTargets, workflow } =
      await loadWorkflow(
        {
          deleted: 3,
          hasStale: true,
        },
        {
          changedFiles: ["packages/contents/articles/politics/new-slug/id.mdx"],
          deletedContentFiles: [
            "packages/contents/articles/politics/old-slug/id.mdx",
          ],
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
        "syncArticles",
        "syncRoutePages",
        "syncPublicRoutes",
        "syncLearningPrograms",
        "invalidateContentRuntimeCache",
        "saveSyncState",
      ])
    );
    expect(events.indexOf("clean")).toBeLessThan(
      events.indexOf("syncArticles")
    );
    expect(routeArtifactTargets).toEqual([
      [
        { locale: "en", section: "articles" },
        { locale: "id", section: "articles" },
      ],
    ]);
    expect(learningProgramOptions).toHaveLength(1);
    expect(learningProgramOptions[0]?.locale).toBeUndefined();
  });

  it("resyncs projected content rows before route artifacts for route-only changes", async () => {
    const { events, routeArtifactTargets, workflow } = await loadWorkflow(
      {
        deleted: 0,
        hasStale: false,
      },
      {
        changedFiles: ["packages/contents/_types/route/tryout/path.ts"],
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
        "syncCurriculumTopics",
        "syncCurriculumLessons",
        "syncTryouts",
        "syncRoutePages",
        "syncPublicRoutes",
        "syncLearningPrograms",
        "invalidateContentRuntimeCache",
        "saveSyncState",
      ])
    );
    expect(events).not.toContain("syncArticles");
    expect(events).not.toContain("clean");
    expect(events.indexOf("syncCurriculumTopics")).toBeLessThan(
      events.indexOf("syncRoutePages")
    );
    expect(events.indexOf("syncCurriculumLessons")).toBeLessThan(
      events.indexOf("syncRoutePages")
    );
    expect(events.indexOf("syncTryouts")).toBeLessThan(
      events.indexOf("syncRoutePages")
    );
    expect(routeArtifactTargets).toEqual([
      [
        { locale: "en", section: "material" },
        { locale: "id", section: "material" },
        { locale: "en", section: "tryout" },
        { locale: "id", section: "tryout" },
      ],
    ]);
    expect(events.indexOf("syncRoutePages")).toBeLessThan(
      events.indexOf("syncPublicRoutes")
    );
    expect(events.indexOf("syncPublicRoutes")).toBeLessThan(
      events.indexOf("syncLearningPrograms")
    );
    expect(events.indexOf("syncLearningPrograms")).toBeLessThan(
      events.indexOf("saveSyncState")
    );
  });

  it("resyncs article rows before route artifacts for graph-only changes", async () => {
    const { events, routeArtifactTargets, workflow } = await loadWorkflow(
      {
        deleted: 0,
        hasStale: false,
      },
      {
        changedFiles: ["packages/contents/_types/graph/projection.ts"],
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
        "syncCurriculumTopics",
        "syncCurriculumLessons",
        "syncTryouts",
        "syncQuran",
        "syncRoutePages",
        "syncPublicRoutes",
        "syncLearningPrograms",
        "invalidateContentRuntimeCache",
        "saveSyncState",
      ])
    );
    expect(events).not.toContain("clean");
    expect(events.indexOf("syncArticles")).toBeLessThan(
      events.indexOf("syncRoutePages")
    );
    expect(events.indexOf("syncCurriculumLessons")).toBeLessThan(
      events.indexOf("syncRoutePages")
    );
    expect(events.indexOf("syncTryouts")).toBeLessThan(
      events.indexOf("syncRoutePages")
    );
    expect(routeArtifactTargets[0]).toHaveLength(8);
    expect(events.indexOf("syncRoutePages")).toBeLessThan(
      events.indexOf("syncPublicRoutes")
    );
  });

  it("syncs Quran without rebuilding unrelated public routes or programs", async () => {
    const { events, routeArtifactTargets, workflow } = await loadWorkflow(
      {
        deleted: 0,
        hasStale: false,
      },
      {
        changedFiles: ["packages/contents/quran/source.ts"],
        syncState: {
          lastSyncCommit: "previous-commit",
          lastSyncTimestamp: 1,
        },
      }
    );

    await Effect.runPromise(workflow.syncIncremental(config, {}));

    expect(events).toEqual(
      expect.arrayContaining([
        "syncQuran",
        "syncRoutePages",
        "invalidateContentRuntimeCache",
        "saveSyncState",
      ])
    );
    expect(events).not.toContain("clean");
    expect(events).not.toContain("syncArticles");
    expect(events).not.toContain("syncCurriculumTopics");
    expect(events).not.toContain("syncCurriculumLessons");
    expect(events).not.toContain("syncTryouts");
    expect(events).not.toContain("syncPublicRoutes");
    expect(events).not.toContain("syncLearningPrograms");
    expect(routeArtifactTargets).toEqual([
      [
        { locale: "en", section: "quran" },
        { locale: "id", section: "quran" },
      ],
    ]);
  });

  it("skips Convex work before saving a no-op incremental sync", async () => {
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

    expect(events).toEqual(["saveSyncState"]);
  });
});

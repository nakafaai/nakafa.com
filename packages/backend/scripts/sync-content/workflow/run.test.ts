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
        "syncPublicRoutes",
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
      events.lastIndexOf("syncPublicRoutes")
    );
    expect(events.lastIndexOf("syncPublicRoutes")).toBeLessThan(
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
      events.lastIndexOf("syncPublicRoutes")
    );
    expect(events.lastIndexOf("syncPublicRoutes")).toBeLessThan(
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
      events.indexOf("syncPublicRoutes")
    );
    expect(events.indexOf("syncPublicRoutes")).toBeLessThan(
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

  it("resyncs projected content rows before route artifacts for route-only changes", async () => {
    const { events, workflow } = await loadWorkflow(
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
        "clean",
        "syncRoutePages",
        "syncPublicRoutes",
        "syncLearningPrograms",
        "invalidateContentRuntimeCache",
        "saveSyncState",
      ])
    );
    expect(events).not.toContain("syncArticles");
    expect(events.indexOf("syncCurriculumTopics")).toBeLessThan(
      events.indexOf("clean")
    );
    expect(events.indexOf("syncCurriculumLessons")).toBeLessThan(
      events.indexOf("clean")
    );
    expect(events.indexOf("syncTryouts")).toBeLessThan(events.indexOf("clean"));
    expect(events.indexOf("clean")).toBeLessThan(
      events.indexOf("syncRoutePages")
    );
    expect(events.indexOf("syncRoutePages")).toBeLessThan(
      events.indexOf("syncPublicRoutes")
    );
    expect(events.indexOf("syncPublicRoutes")).toBeLessThan(
      events.indexOf("syncLearningPrograms")
    );
  });

  it("resyncs article rows before route artifacts for graph-only changes", async () => {
    const { events, workflow } = await loadWorkflow(
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
        "clean",
        "syncRoutePages",
        "syncPublicRoutes",
        "syncLearningPrograms",
        "invalidateContentRuntimeCache",
        "saveSyncState",
      ])
    );
    expect(events.indexOf("syncArticles")).toBeLessThan(
      events.indexOf("clean")
    );
    expect(events.indexOf("syncCurriculumLessons")).toBeLessThan(
      events.indexOf("clean")
    );
    expect(events.indexOf("syncTryouts")).toBeLessThan(events.indexOf("clean"));
    expect(events.indexOf("clean")).toBeLessThan(
      events.indexOf("syncRoutePages")
    );
    expect(events.indexOf("syncRoutePages")).toBeLessThan(
      events.indexOf("syncPublicRoutes")
    );
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

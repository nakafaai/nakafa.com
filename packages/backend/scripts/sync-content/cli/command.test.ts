import { NAKAFA_CONTENT_SECTIONS } from "@repo/backend/convex/contents/constants";
import type { NakafaSection } from "@repo/backend/convex/lib/validators/contents";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/contract/types";
import type { ContentRouteArtifactTarget } from "@repo/backend/scripts/sync-content/routes/artifacts";
import { locales } from "@repo/utilities/locales";
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

interface CliTestOptions {
  cleanDeleted?: number;
  learningProgramFails?: boolean;
}

/** Loads the CLI with mocked sync dependencies and records command ordering. */
const loadCli = async (options: CliTestOptions = {}) => {
  const artifactTargets: (readonly ContentRouteArtifactTarget[])[] = [];
  const events: string[] = [];
  const invalidatedOptions: SyncOptions[] = [];

  /** Builds a successful sync command that records when it runs. */
  const recordSync = (event: string) => () => {
    events.push(event);
    return Effect.succeed(syncResult);
  };

  vi.doMock("@repo/backend/scripts/sync-content/content/articles", () => ({
    syncArticles: recordSync("syncArticles"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/content/authors", () => ({
    syncAuthors: recordSync("syncAuthors"),
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
    clean: () => {
      events.push("clean");
      return Effect.succeed({ deleted: options.cleanDeleted ?? 0 });
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/convex/client", () => ({
    /** Supplies deterministic Convex config without reading environment. */
    getConvexConfig: () => {
      events.push("getConvexConfig");
      return Effect.succeed(config);
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/content/tryouts", () => ({
    syncTryouts: recordSync("syncTryouts"),
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
  vi.doMock("@repo/backend/scripts/sync-content/content/quran", () => ({
    syncQuran: recordSync("syncQuran"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/cli/logging", () => ({
    /** Suppresses normal CLI usage logs. */
    log: () => undefined,
    /** Suppresses normal CLI error logs. */
    logError: () => undefined,
  }));
  vi.doMock("@repo/backend/scripts/sync-content/cleanup/reset", () => ({
    reset: recordSync("reset"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/cleanup/analytics", () => ({
    resetAnalytics: recordSync("resetAnalytics"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/cleanup/audio", () => ({
    resetAudio: recordSync("resetAudio"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/cleanup/tryouts", () => ({
    resetTryouts: recordSync("resetTryouts"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/content/curriculum", () => ({
    syncCurriculumLessons: recordSync("syncCurriculumLessons"),
    syncCurriculumTopics: recordSync("syncCurriculumTopics"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/content/validate", () => ({
    validate: recordSync("validate"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/verify/sync", () => ({
    verify: recordSync("verify"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/routes/artifacts", () => ({
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
    syncContentRouteArtifactPages: (
      _config: ConvexConfig,
      targets: readonly ContentRouteArtifactTarget[]
    ) => {
      events.push("syncContentRouteArtifactPages");
      artifactTargets.push(targets);
      return Effect.succeed(syncResult);
    },
  }));
  vi.doMock("@repo/backend/scripts/sync-content/routes/sync", () => ({
    syncPublicRoutes: recordSync("syncPublicRoutes"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/workflow/full", () => ({
    syncFull: recordSync("syncFull"),
  }));
  vi.doMock("@repo/backend/scripts/sync-content/workflow/run", () => ({
    syncAll: recordSync("syncAll"),
    syncIncremental: recordSync("syncIncremental"),
    /** Mirrors the workflow boundary so parser tests exercise its shared validation call. */
    validateIncrementalSyncOptions: (syncOptions: SyncOptions) => {
      if (!syncOptions.locale) {
        return Effect.void;
      }

      return Effect.fail(
        new Error(
          "Incremental sync does not support --locale because sync state is shared across locales"
        )
      );
    },
  }));

  const cli = await import("@repo/backend/scripts/sync-content/cli/command");

  return { artifactTargets, cli, events, invalidatedOptions };
};

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("sync-content cli", () => {
  it("accepts every configured locale", async () => {
    const { cli } = await loadCli();

    for (const locale of locales) {
      const result = await Effect.runPromise(
        cli.parseSyncArgs(["all", "--locale", locale])
      );

      expect(result.options.locale).toBe(locale);
    }
  });

  it("rejects missing and unsupported locale arguments", async () => {
    const { cli } = await loadCli();

    await expect(
      Effect.runPromise(cli.parseSyncArgs(["all", "--locale"]))
    ).rejects.toThrow("Invalid locale: missing");
    await expect(
      Effect.runPromise(cli.parseSyncArgs(["all", "--locale", "unsupported"]))
    ).rejects.toThrow("Invalid locale: unsupported");
  });

  it("rejects locale-scoped incremental sync before its workflow can advance shared state", async () => {
    const { cli, events } = await loadCli();
    const program = cli
      .parseSyncArgs(["incremental", "--locale", "id"])
      .pipe(
        Effect.flatMap(({ options, type }) => cli.runCommand(type, options))
      );

    await expect(Effect.runPromise(program)).rejects.toThrow(
      "Incremental sync does not support --locale because sync state is shared across locales"
    );
    expect(events).toEqual([]);
  });

  it.each([
    "full",
    "reset",
  ])("keeps locale scoping available for %s sync", async (command) => {
    const { cli } = await loadCli();

    const result = await Effect.runPromise(
      cli.parseSyncArgs([command, "--locale", "id"])
    );

    expect(result.options.locale).toBe("id");
  });

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

  it.each([
    [
      "articles",
      ["syncAuthors", "syncArticles", "syncContentRouteArtifactPages"],
    ],
    ["quran", ["syncQuran", "syncContentRouteArtifactPages"]],
    [
      "subjects",
      [
        "syncAuthors",
        "syncCurriculumTopics",
        "syncCurriculumLessons",
        "syncContentRouteArtifactPages",
        "syncPublicRoutes",
        "syncLearningPrograms",
      ],
    ],
    [
      "curriculum-topics",
      [
        "syncAuthors",
        "syncCurriculumTopics",
        "syncContentRouteArtifactPages",
        "syncPublicRoutes",
        "syncLearningPrograms",
      ],
    ],
    [
      "curriculum-lessons",
      [
        "syncAuthors",
        "syncCurriculumLessons",
        "syncContentRouteArtifactPages",
        "syncPublicRoutes",
        "syncLearningPrograms",
      ],
    ],
    [
      "tryouts",
      [
        "syncAuthors",
        "syncTryouts",
        "syncContentRouteArtifactPages",
        "syncPublicRoutes",
        "syncLearningPrograms",
      ],
    ],
    ["public-routes", ["syncPublicRoutes"]],
    ["all", ["syncAll"]],
  ])("refreshes derived data and cache after %s", async (command, steps) => {
    const { cli, events, invalidatedOptions } = await loadCli();
    const options: SyncOptions = { locale: "id" };

    await Effect.runPromise(cli.runCommand(command, options));

    expect(events).toEqual([
      "getConvexConfig",
      ...steps,
      "invalidateContentRuntimeCache",
    ]);
    expect(invalidatedOptions).toEqual([options]);
  });

  it.each([
    ["articles", "articles"],
    ["quran", "quran"],
    ["subjects", "material"],
    ["curriculum-topics", "material"],
    ["curriculum-lessons", "material"],
    ["tryouts", "tryout"],
  ] as const)("limits %s route artifacts to its owning section", async (command, section) => {
    const { artifactTargets, cli } = await loadCli();

    await Effect.runPromise(cli.runCommand(command, { locale: "id" }));

    expect(artifactTargets).toEqual([[{ locale: "id", section }]]);
  });

  it.each([
    ["reset", "reset"],
    ["reset-tryouts", "resetTryouts"],
  ])("invalidates cache after forced %s", async (command, resetEvent) => {
    const { cli, events } = await loadCli();

    await Effect.runPromise(cli.runCommand(command, { force: true }));

    expect(events).toEqual([
      "getConvexConfig",
      resetEvent,
      "invalidateContentRuntimeCache",
    ]);
  });

  it("rebuilds every locale and invalidates after forced cleanup deletes rows", async () => {
    const { artifactTargets, cli, events, invalidatedOptions } = await loadCli({
      cleanDeleted: 2,
    });
    const options: SyncOptions = { force: true, locale: "id" };
    const expectedOptions: SyncOptions = { force: true, locale: undefined };

    await Effect.runPromise(cli.runCommand("clean", options));

    expect(events).toEqual([
      "getConvexConfig",
      "clean",
      "syncContentRouteArtifactPages",
      "syncPublicRoutes",
      "syncLearningPrograms",
      "invalidateContentRuntimeCache",
    ]);
    expect(artifactTargets[0]).toHaveLength(8);
    expect(new Set(artifactTargets[0]?.map((target) => target.locale))).toEqual(
      new Set(locales)
    );
    expect(invalidatedOptions).toEqual([expectedOptions]);
  });

  it("does not rebuild or invalidate when cleanup deletes no rows", async () => {
    const { cli, events } = await loadCli();

    await Effect.runPromise(cli.runCommand("clean", { force: true }));

    expect(events).toEqual(["getConvexConfig", "clean"]);
  });
});

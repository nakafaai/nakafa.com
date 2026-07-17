import {
  type NakafaSection,
  SUPPORTED_CONTENT_LOCALES,
} from "@repo/backend/convex/lib/validators/contents";
import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

interface RoutePage {
  continueCursor: string;
  isDone: boolean;
  page: ReturnType<typeof contentRoute>[];
}

interface RouteCount {
  count: number;
  locale: (typeof SUPPORTED_CONTENT_LOCALES)[number];
  section: NakafaSection;
  syncedAt: number;
}

/** Registers Convex call mocks for route artifact sync scenarios. */
const loadRoutesScript = async ({
  committedCounts = [],
  deleteBatches = [0],
  pagesBySection = {},
}: {
  committedCounts?: RouteCount[];
  deleteBatches?: number[];
  pagesBySection?: Partial<Record<NakafaSection, RoutePage[]>>;
} = {}) => {
  const deleteCalls: unknown[] = [];
  const operationCalls: unknown[] = [];
  const mutationCalls: unknown[] = [];
  const queryCalls: unknown[] = [];
  const sectionPageIndexes = new Map<string, number>();

  vi.doMock("@repo/backend/scripts/sync-content/convex/client", () => ({
    callConvexMutation: (
      _config: ConvexConfig,
      _functionRef: unknown,
      args: unknown
    ) => {
      operationCalls.push(args);

      if (isDeleteStalePageArgs(args)) {
        deleteCalls.push(args);
        const deleted = deleteBatches.shift() ?? 0;
        return Effect.succeed({ deleted });
      }

      mutationCalls.push(args);
      return Effect.succeed({ created: 1, unchanged: 0, updated: 0 });
    },
    callConvexQuery: (
      _config: ConvexConfig,
      _functionRef: unknown,
      args: { locale: RouteCount["locale"]; section?: NakafaSection }
    ) => {
      queryCalls.push(args);

      if (!args.section) {
        return Effect.succeed(
          committedCounts.filter((count) => count.locale === args.locale)
        );
      }

      const key = `${args.locale}:${args.section}`;
      const index = sectionPageIndexes.get(key) ?? 0;
      sectionPageIndexes.set(key, index + 1);

      return Effect.succeed(
        pagesBySection[args.section]?.[index] ?? emptyRoutePage()
      );
    },
  }));

  const routes = await import(
    "@repo/backend/scripts/sync-content/routes/artifacts"
  );

  return { deleteCalls, mutationCalls, operationCalls, queryCalls, routes };
};

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("sync-content routes", () => {
  it("commits counts after pages and before deleting old generations", async () => {
    const { deleteCalls, mutationCalls, operationCalls, queryCalls, routes } =
      await loadRoutesScript({
        deleteBatches: [2, 0],
        pagesBySection: {
          articles: [
            routePage({
              continueCursor: "cursor-1",
              isDone: false,
              routes: [
                contentRoute("articles/politics/first"),
                contentRoute("articles/politics/second"),
              ],
            }),
            routePage({
              routes: [contentRoute("articles/politics/third")],
            }),
          ],
        },
      });

    const result = await Effect.runPromise(
      routes.syncContentRouteArtifactPages(config, [
        { locale: "id", section: "articles" },
      ])
    );

    const countCalls = mutationCalls.filter(isCountMutationCall);
    const articlePageCalls = mutationCalls.filter(isPageMutationCall);
    const articleCount = countCalls.find((call) => call.section === "articles");
    const articleOperations = operationCalls.filter(
      (call) => getSection(call) === "articles"
    );

    expect(result).toEqual({ created: 2, unchanged: 0, updated: 0 });
    expect(queryCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cursor: null, section: "articles" }),
        expect.objectContaining({ cursor: "cursor-1", section: "articles" }),
      ])
    );
    expect(articlePageCalls.map((call) => call.page)).toEqual([0, 1]);
    expect(articleCount).toEqual(
      expect.objectContaining({ count: 3, locale: "id", section: "articles" })
    );
    expect(articleOperations).toEqual([
      expect.objectContaining({ page: 0, routes: expect.any(Array) }),
      expect.objectContaining({ page: 1, routes: expect.any(Array) }),
      expect.objectContaining({ count: 3 }),
      expect.objectContaining({ committedSyncedAt: expect.any(Number) }),
      expect.objectContaining({ committedSyncedAt: expect.any(Number) }),
    ]);
    expect(deleteCalls.filter(isDeleteStalePageArgs)).toEqual([
      expect.objectContaining({ section: "articles" }),
      expect.objectContaining({ section: "articles" }),
    ]);
  });

  it("rebuilds count rows for every locale when no locale filter is provided", async () => {
    const { mutationCalls, routes } = await loadRoutesScript();

    await Effect.runPromise(
      routes.syncContentRouteArtifactPages(
        config,
        routes.createContentRouteArtifactTargets()
      )
    );

    const countCalls = mutationCalls.filter(isCountMutationCall);

    expect(countCalls).toHaveLength(8);
    expect(new Set(countCalls.map((call) => call.locale))).toEqual(
      new Set(SUPPORTED_CONTENT_LOCALES)
    );
    expect(new Set(countCalls.map((call) => call.section))).toEqual(
      new Set(["articles", "material", "tryout", "quran"])
    );
  });

  it("uses a generation newer than the committed section pointer", async () => {
    vi.spyOn(Date, "now").mockReturnValue(100);
    const { mutationCalls, routes } = await loadRoutesScript({
      committedCounts: [
        { count: 1, locale: "id", section: "articles", syncedAt: 500 },
        { count: 4, locale: "id", section: "material", syncedAt: 900 },
      ],
    });

    await Effect.runPromise(
      routes.syncContentRouteArtifactPages(config, [
        { locale: "id", section: "articles" },
      ])
    );

    expect(mutationCalls).toEqual([
      expect.objectContaining({
        count: 0,
        locale: "id",
        section: "articles",
        syncedAt: 501,
      }),
    ]);
  });
});

/** Builds one mocked route page returned by the runtime route catalog query. */
function routePage({
  continueCursor = "",
  isDone = true,
  routes,
}: {
  continueCursor?: string;
  isDone?: boolean;
  routes: RoutePage["page"];
}): RoutePage {
  return { continueCursor, isDone, page: routes };
}

/** Builds an empty terminal route page. */
function emptyRoutePage(): RoutePage {
  return routePage({ routes: [] });
}

/** Checks whether one mocked mutation call deletes stale artifact pages. */
function isDeleteStalePageArgs(
  args: unknown
): args is { committedSyncedAt: number; section: NakafaSection } {
  return (
    typeof args === "object" && args !== null && "committedSyncedAt" in args
  );
}

/** Reads a section discriminator from one recorded Convex mutation call. */
function getSection(args: unknown) {
  if (typeof args !== "object" || args === null || !("section" in args)) {
    return;
  }

  return args.section;
}

/** Checks whether one mocked mutation call syncs a section route count. */
function isCountMutationCall(args: unknown): args is {
  count: number;
  locale: string;
  section: NakafaSection;
} {
  return typeof args === "object" && args !== null && "count" in args;
}

/** Checks whether one mocked mutation call syncs a concrete artifact page. */
function isPageMutationCall(args: unknown): args is {
  page: number;
  routes: RoutePage["page"];
} {
  return typeof args === "object" && args !== null && "routes" in args;
}

/** Builds one route row returned by the runtime route catalog query. */
function contentRoute(route: string) {
  const identity = createLearningGraphIdentityFromRoute({
    locale: "id",
    route,
  });

  if (!identity) {
    throw new Error(`Invalid route fixture: ${route}`);
  }

  return {
    ...identity,
    authors: [{ name: "Nakafa Author" }],
    content_id: identity.assetId,
    date: 1,
    depth: route.split("/").length,
    description: undefined,
    kind: "article" as const,
    locale: "id" as const,
    markdown: true,
    official: undefined,
    parentRoute: "articles/politics",
    route,
    section: "articles" as const,
    syncedAt: 1,
    title: route,
  };
}

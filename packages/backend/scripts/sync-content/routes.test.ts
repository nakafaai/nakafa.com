import type { NakafaSection } from "@repo/backend/convex/lib/validators/contents";
import type { ConvexConfig } from "@repo/backend/scripts/sync-content/types";
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

/** Registers Convex call mocks for route artifact sync scenarios. */
const loadRoutesScript = async ({
  deleteBatches = [0],
  pagesBySection = {},
}: {
  deleteBatches?: number[];
  pagesBySection?: Partial<Record<NakafaSection, RoutePage[]>>;
} = {}) => {
  const deleteCalls: unknown[] = [];
  const mutationCalls: unknown[] = [];
  const queryCalls: unknown[] = [];
  const sectionPageIndexes = new Map<NakafaSection, number>();

  vi.doMock("@repo/backend/scripts/sync-content/convex", () => ({
    callConvexMutation: (
      _config: ConvexConfig,
      _functionRef: unknown,
      args: unknown
    ) => {
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
      args: { section: NakafaSection }
    ) => {
      queryCalls.push(args);
      const index = sectionPageIndexes.get(args.section) ?? 0;
      sectionPageIndexes.set(args.section, index + 1);

      return Effect.succeed(
        pagesBySection[args.section]?.[index] ?? emptyRoutePage()
      );
    },
  }));

  const routes = await import("@repo/backend/scripts/sync-content/routes");

  return { deleteCalls, mutationCalls, queryCalls, routes };
};

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("sync-content routes", () => {
  it("materializes counts after paginating route pages and deleting stale pages", async () => {
    const { deleteCalls, mutationCalls, queryCalls, routes } =
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
      routes.syncContentRouteArtifactPages(config, { locale: "id" })
    );

    const countCalls = mutationCalls.filter(isCountMutationCall);
    const articlePageCalls = mutationCalls.filter(isPageMutationCall);
    const articleCount = countCalls.find((call) => call.section === "articles");

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
    expect(deleteCalls.filter(isDeleteStalePageArgs)).toEqual([
      expect.objectContaining({ firstStalePage: 2, section: "articles" }),
      expect.objectContaining({ firstStalePage: 2, section: "articles" }),
      expect.objectContaining({ firstStalePage: 0, section: "subject" }),
      expect.objectContaining({ firstStalePage: 0, section: "exercises" }),
      expect.objectContaining({ firstStalePage: 0, section: "quran" }),
    ]);
  });

  it("rebuilds count rows for every locale when no locale filter is provided", async () => {
    const { mutationCalls, routes } = await loadRoutesScript();

    await Effect.runPromise(routes.syncContentRouteArtifactPages(config, {}));

    const countCalls = mutationCalls.filter(isCountMutationCall);

    expect(countCalls).toHaveLength(8);
    expect(new Set(countCalls.map((call) => call.locale))).toEqual(
      new Set(["en", "id"])
    );
    expect(new Set(countCalls.map((call) => call.section))).toEqual(
      new Set(["articles", "exercises", "quran", "subject"])
    );
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
): args is { firstStalePage: number; section: NakafaSection } {
  return typeof args === "object" && args !== null && "firstStalePage" in args;
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
  return {
    authors: [{ name: "Nakafa Author" }],
    content_id: `id/${route}`,
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

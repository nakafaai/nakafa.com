import type { NakafaSection } from "@repo/backend/convex/lib/validators/contents";
import type { ConvexConfig } from "@repo/backend/scripts/sync-content/types";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

/** Registers Convex call mocks for the route artifact sync script. */
const loadRoutesScript = async () => {
  const mutationCalls: unknown[] = [];

  vi.doMock("@repo/backend/scripts/sync-content/convex", () => ({
    callConvexMutation: (
      _config: ConvexConfig,
      _functionRef: unknown,
      args: unknown
    ) => {
      if (isDeleteStalePageArgs(args)) {
        return Effect.succeed({ deleted: 0 });
      }

      mutationCalls.push(args);
      return Effect.succeed({ created: 1, unchanged: 0, updated: 0 });
    },
    callConvexQuery: (
      _config: ConvexConfig,
      _functionRef: unknown,
      args: { section: NakafaSection }
    ) =>
      Effect.succeed({
        continueCursor: "",
        isDone: true,
        page: args.section === "articles" ? articleRoutes : [],
      }),
  }));

  const routes = await import("@repo/backend/scripts/sync-content/routes");

  return { mutationCalls, routes };
};

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("sync-content routes", () => {
  it("materializes section counts from rebuilt route artifact pages", async () => {
    const { mutationCalls, routes } = await loadRoutesScript();

    await Effect.runPromise(
      routes.syncContentRouteArtifactPages(config, {
        locale: "id",
      })
    );

    const countCalls = mutationCalls.filter(isCountMutationCall);
    const articleCount = countCalls.find((call) => call.section === "articles");

    expect(articleCount).toEqual(
      expect.objectContaining({
        count: 2,
        locale: "id",
        section: "articles",
      })
    );
    expect(countCalls.map((call) => call.section).sort()).toEqual([
      "articles",
      "exercises",
      "quran",
      "subject",
    ]);
  });
});

/** Checks whether one mocked mutation call deletes stale artifact pages. */
function isDeleteStalePageArgs(
  args: unknown
): args is { firstStalePage: number } {
  return typeof args === "object" && args !== null && "firstStalePage" in args;
}

/** Checks whether one mocked mutation call syncs a section route count. */
function isCountMutationCall(args: unknown): args is {
  count: number;
  section: NakafaSection;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "count" in args &&
    "section" in args
  );
}

const articleRoutes = [
  contentRoute("articles/politics/first"),
  contentRoute("articles/politics/second"),
];

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

// @vitest-environment node
import type { api } from "@repo/backend/convex/_generated/api";
import type { Locale } from "@repo/contents/_types/content";
import {
  createLearningGraphIdentityFromRoute,
  getLearningObjectKindForRoute,
} from "@repo/contents/_types/learning-graph";
import type { SourceRegistryRoot } from "@repo/contents/_types/source-registry";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_URL } from "@/lib/llms/constants";
import {
  getContentListingLlmsEntries,
  getContentPageLlmsEntries,
  getLlmsSections,
  getRouteSection,
  getSiteLlmsEntries,
  isLlmsSection,
} from "@/lib/llms/entries";

type RuntimeContentRoute = FunctionReturnType<
  typeof api.contents.queries.runtime.getContentRouteArtifactPage
>;
type RuntimeContentRouteItem =
  NonNullable<RuntimeContentRoute>["routes"][number];

const mockGetRuntimeContentRoute = vi.hoisted(() => vi.fn());
const mockGetRuntimeContentRouteArtifactPage = vi.hoisted(() => vi.fn());
const mockGetRuntimeContentRouteKindPage = vi.hoisted(() => vi.fn());
const mockGetRuntimeContentRouteParentPage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/llms/quran", () => ({
  getQuranRouteMetadata: () =>
    Effect.succeed({
      description: "Quran index",
      hasMarkdown: true,
      title: "Al-Quran",
    }),
}));

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRoute: mockGetRuntimeContentRoute,
  getRuntimeContentRouteArtifactPage: mockGetRuntimeContentRouteArtifactPage,
  getRuntimeContentRouteKindPage: mockGetRuntimeContentRouteKindPage,
  getRuntimeContentRouteParentPage: mockGetRuntimeContentRouteParentPage,
}));

beforeEach(() => {
  mockGetRuntimeContentRoute.mockReset();
  mockGetRuntimeContentRouteArtifactPage.mockReset();
  mockGetRuntimeContentRouteKindPage.mockReset();
  mockGetRuntimeContentRouteParentPage.mockReset();
  mockGetRuntimeContentRouteArtifactPage.mockImplementation(
    ({ locale, page, section }) =>
      Effect.succeed({
        locale,
        page,
        routeCount: routeRows.length,
        routes: routeRows.filter((route) => route.section === section),
        section,
        syncedAt: 1,
      })
  );
  mockGetRuntimeContentRouteKindPage.mockImplementation(({ prefix }) =>
    Effect.succeed({
      continueCursor: null,
      isDone: true,
      page: routeRows.filter((row) => row.route.startsWith(prefix)),
    })
  );
  mockGetRuntimeContentRouteParentPage.mockImplementation(({ parentRoute }) =>
    Effect.succeed({
      continueCursor: null,
      isDone: true,
      page: routeRows.filter((row) => row.route.startsWith(`${parentRoute}/`)),
    })
  );
  mockGetRuntimeContentRoute.mockImplementation(({ route }) => {
    if (route === "articles/politics/dynastic-politics-asian-values") {
      return Effect.succeed({
        description:
          "Power is passed down under the guise of practicing asian values.",
        markdown: true,
        title:
          "Framing Dynastic Politics in Local Elections within Asian Values",
      });
    }

    if (route === "articles/politics/fail") {
      return Effect.fail(new Error("Runtime metadata unavailable."));
    }

    if (route === "subjects/chemistry/green-chemistry/definition") {
      return Effect.succeed({
        description: "Green Chemistry",
        markdown: true,
        title: "Definition of Green Chemistry",
      });
    }

    return Effect.succeed(null);
  });
});

const routeRows = [
  routeRow({
    markdown: false,
    route: "articles/politics/fail",
    section: "articles",
    title: "Fail",
  }),
  routeRow({
    description:
      "Power is passed down under the guise of practicing asian values.",
    route: "articles/politics/dynastic-politics-asian-values",
    section: "articles",
    title: "Framing Dynastic Politics in Local Elections within Asian Values",
  }),
  routeRow({
    description: "A short article fixture.",
    route: "articles/politics/aaa-short-fixture",
    section: "articles",
    title: "A Short Fixture",
  }),
  routeRow({
    description: "Quran index",
    route: "quran/1",
    section: "quran",
    title: "Al-Quran",
  }),
  routeRow({
    description: "Green Chemistry",
    route: "subjects/chemistry/green-chemistry/definition",
    section: "material",
    sourcePath: "material/lesson/chemistry/green-chemistry/definition",
    title: "Definition of Green Chemistry",
  }),
];

/** Builds one route-catalog fixture row for llms entry tests. */
function routeRow({
  description = "Description",
  markdown = true,
  route,
  section,
  sourcePath = route,
  title = "Title",
}: {
  description?: string;
  markdown?: boolean;
  route: string;
  section: SourceRegistryRoot;
  sourcePath?: string;
  title?: string;
}): RuntimeContentRouteItem {
  const graph = routeGraph("en", sourcePath);
  const kind = getLearningObjectKindForRoute(sourcePath, "en");

  if (!kind) {
    expect.fail(`Expected graph route kind for ${sourcePath}.`);
  }

  return {
    ...graph,
    authors: [{ name: "Nakafa" }],
    date: 1_735_689_600_000,
    description,
    kind,
    locale: "en",
    markdown,
    official: false,
    route,
    section,
    sourcePath,
    syncedAt: 1,
    title,
  };
}

/** Builds graph identity fields for a content-route fixture. */
function routeGraph(locale: Locale, route: string) {
  const identity = createLearningGraphIdentityFromRoute({ locale, route });

  if (!identity) {
    expect.fail(`Expected graph identity for ${route}.`);
  }

  return {
    ...identity,
    content_id: identity.assetId,
  };
}

describe("llms entries", () => {
  it("classifies supported llms sections and falls back to site", () => {
    expect(getRouteSection("/articles/politics")).toBe("articles");
    expect(getRouteSection("/subjects/chemistry/green-chemistry")).toBe(
      "material"
    );
    expect(getRouteSection("/try-out/indonesia/snbt")).toBe("site");
    expect(getRouteSection("/site/about")).toBe("site");
    expect(getRouteSection("/")).toBe("site");
    expect(isLlmsSection("articles")).toBe(true);
    expect(isLlmsSection("unknown")).toBe(false);
    expect(isLlmsSection(undefined)).toBe(false);
    expect(getLlmsSections()).toEqual([
      "articles",
      "material",
      "quran",
      "site",
    ]);
  });

  it("builds page entries only for markdown-capable source routes", async () => {
    const entries = await Effect.runPromise(
      Effect.all([
        getContentPageLlmsEntries({
          locale: "en",
          page: 0,
          section: "articles",
        }),
        getContentPageLlmsEntries({
          locale: "en",
          page: 0,
          section: "material",
        }),
        getContentPageLlmsEntries({
          locale: "en",
          page: 0,
          section: "quran",
        }),
        getSiteLlmsEntries("en"),
      ]).pipe(Effect.map((groups) => groups.flat()))
    );
    const hrefs = entries.map((entry) => entry.href);

    expect(entries).toContainEqual(
      expect.objectContaining({
        description:
          "Power is passed down under the guise of practicing asian values.",
        href: `${BASE_URL}/en/articles/politics/dynastic-politics-asian-values.md`,
        route: "/articles/politics/dynastic-politics-asian-values",
        section: "articles",
        title:
          "Framing Dynastic Politics in Local Elections within Asian Values",
      })
    );
    expect(hrefs).not.toContain(`${BASE_URL}/en/articles/politics/fail`);
    expect(entries).toContainEqual(
      expect.objectContaining({
        description: "Green Chemistry",
        href: `${BASE_URL}/en/subjects/chemistry/green-chemistry/definition.md`,
        route: "/subjects/chemistry/green-chemistry/definition",
        section: "material",
        title: "Definition of Green Chemistry",
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        description: "Quran index",
        href: `${BASE_URL}/en/quran/1.md`,
        route: "/quran/1",
        section: "quran",
        title: "Al-Quran",
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        href: `${BASE_URL}/en`,
        route: "/",
        section: "site",
        title: "Home",
      })
    );
    expect(hrefs).not.toContain(`${BASE_URL}/en/articles/politics.md`);
    expect(mockGetRuntimeContentRoute).not.toHaveBeenCalled();
    expect(mockGetRuntimeContentRouteArtifactPage).toHaveBeenCalledWith({
      locale: "en",
      page: 0,
      section: "articles",
    });
  });

  it("builds listing entries from parent-scoped route rows", async () => {
    const entries = await Effect.runPromise(
      getContentListingLlmsEntries({
        locale: "en",
        route: "articles/politics",
      })
    );

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: `${BASE_URL}/en/articles/politics/dynastic-politics-asian-values.md`,
          route: "/articles/politics/dynastic-politics-asian-values",
        }),
      ])
    );
    expect(mockGetRuntimeContentRouteParentPage).toHaveBeenCalledWith({
      cursor: null,
      kind: "article",
      limit: 100,
      locale: "en",
      order: "date-desc",
      parentRoute: "articles/politics",
      section: "articles",
    });
  });

  it("returns null for curriculum app route listings", async () => {
    await expect(
      Effect.runPromise(
        getContentListingLlmsEntries({
          locale: "en",
          route: "curriculum/merdeka/class-10/mathematics/integral",
        })
      )
    ).resolves.toBeNull();

    expect(mockGetRuntimeContentRouteKindPage).not.toHaveBeenCalled();
    expect(mockGetRuntimeContentRouteParentPage).not.toHaveBeenCalled();
  });

  it("returns null for routes without listing markdown support", async () => {
    await expect(
      Effect.runPromise(
        getContentListingLlmsEntries({
          locale: "en",
          route: "articles",
        })
      )
    ).resolves.toBeNull();

    expect(mockGetRuntimeContentRouteKindPage).not.toHaveBeenCalled();
    expect(mockGetRuntimeContentRouteParentPage).not.toHaveBeenCalled();
  });

  it("returns no entries when a materialized route page is missing", async () => {
    mockGetRuntimeContentRouteArtifactPage.mockReturnValueOnce(
      Effect.succeed(null)
    );

    await expect(
      Effect.runPromise(
        getContentPageLlmsEntries({
          locale: "en",
          page: 404,
          section: "articles",
        })
      )
    ).resolves.toEqual([]);
  });

  it("skips material rows that do not project to public routes", async () => {
    mockGetRuntimeContentRouteArtifactPage.mockReturnValueOnce(
      Effect.succeed({
        locale: "en",
        page: 0,
        routeCount: 1,
        routes: [
          routeRow({
            route: "subjects/chemistry/green-chemistry/missing",
            section: "material",
            sourcePath: "material/lesson/chemistry/green-chemistry/missing",
          }),
        ],
        section: "material",
        syncedAt: 1,
      })
    );

    await expect(
      Effect.runPromise(
        getContentPageLlmsEntries({
          locale: "en",
          page: 0,
          section: "material",
        })
      )
    ).resolves.toEqual([]);
  });
});

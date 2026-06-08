// @vitest-environment node
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
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

vi.mock("@/lib/llms/quran", () => ({
  getQuranRouteMetadata: () =>
    Effect.succeed({
      description: "Quran index",
      hasMarkdown: true,
      title: "Al-Quran",
    }),
}));

vi.mock("@/lib/content/runtime", () => ({
  getRuntimeContentRoute: mockGetRuntimeContentRoute,
  getRuntimeContentRouteArtifactPage: mockGetRuntimeContentRouteArtifactPage,
}));

beforeEach(() => {
  mockGetRuntimeContentRoute.mockReset();
  mockGetRuntimeContentRouteArtifactPage.mockReset();
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

    if (
      route === "subject/high-school/10/chemistry/green-chemistry/definition"
    ) {
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
    route: "articles/politics/fail",
    section: "articles",
  }),
  routeRow({
    route: "articles/politics/dynastic-politics-asian-values",
    section: "articles",
  }),
  routeRow({
    route:
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
    section: "exercises",
  }),
  routeRow({
    route: "quran/1",
    section: "quran",
  }),
  routeRow({
    route: "subject/high-school/10/chemistry/green-chemistry/definition",
    section: "subject",
  }),
];

/** Builds one route-catalog fixture row for llms entry tests. */
function routeRow({
  route,
  section,
}: {
  route: string;
  section: "articles" | "subject" | "exercises" | "quran";
}): RuntimeContentRouteItem {
  return {
    authors: [{ name: "Nakafa" }],
    content_id: `en/${route}`,
    date: 1_735_689_600_000,
    description: "Description",
    kind: "article",
    locale: "en",
    markdown: true,
    official: false,
    route,
    section,
    syncedAt: 1,
    title: "Title",
  };
}

describe("llms entries", () => {
  it("classifies supported llms sections and falls back to site", () => {
    expect(getRouteSection("/articles/politics")).toBe("articles");
    expect(getRouteSection("/site/about")).toBe("site");
    expect(getRouteSection("/")).toBe("site");
    expect(isLlmsSection("articles")).toBe(true);
    expect(isLlmsSection("unknown")).toBe(false);
    expect(isLlmsSection(undefined)).toBe(false);
    expect(getLlmsSections()).toEqual([
      "articles",
      "exercises",
      "quran",
      "site",
      "subject",
    ]);
  });

  it("builds page entries with markdown links and metadata subject fallback", async () => {
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
          section: "subject",
        }),
        getContentPageLlmsEntries({
          locale: "en",
          page: 0,
          section: "exercises",
        }),
        getContentPageLlmsEntries({
          locale: "en",
          page: 0,
          section: "quran",
        }),
        getSiteLlmsEntries("en"),
      ]).pipe(Effect.map((groups) => groups.flat()))
    );

    expect(entries).toContainEqual(
      expect.objectContaining({
        description:
          "Power is passed down under the guise of practicing asian values.",
        href: "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values.md",
        route: "/articles/politics/dynastic-politics-asian-values",
        section: "articles",
        title:
          "Framing Dynastic Politics in Local Elections within Asian Values",
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        href: "https://nakafa.com/en/articles/politics/fail.md",
        route: "/articles/politics/fail",
        section: "articles",
        title: "Fail",
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        description: "Green Chemistry",
        href: "https://nakafa.com/en/subject/high-school/10/chemistry/green-chemistry/definition.md",
        route: "/subject/high-school/10/chemistry/green-chemistry/definition",
        section: "subject",
        title: "Definition of Green Chemistry",
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        href: "https://nakafa.com/en/subject/high-school/10.md",
        route: "/subject/high-school/10",
        section: "subject",
        title: "10",
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        href: "https://nakafa.com/en/exercises/high-school/snbt/quantitative-knowledge/try-out/2026.md",
        route:
          "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
        section: "exercises",
        title: "2026",
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        description: "Quran index",
        href: "https://nakafa.com/en/quran/1.md",
        route: "/quran/1",
        section: "quran",
        title: "Al-Quran",
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        href: "https://nakafa.com/en",
        route: "/",
        section: "site",
        title: "Home",
      })
    );
    expect(mockGetRuntimeContentRouteArtifactPage).toHaveBeenCalledWith({
      locale: "en",
      page: 0,
      section: "articles",
    });
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
});

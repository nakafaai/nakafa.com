// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_URL } from "@/lib/llms/constants";
import {
  getContentListingLlmsEntries,
  getContentPageLlmsEntries,
  getLlmsSections,
  getSiteLlmsEntries,
  isLlmsSection,
} from "@/lib/llms/entries";

const mockGetArtifactPage = vi.hoisted(() => vi.fn());
const mockGetParentPage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRouteArtifactPage: mockGetArtifactPage,
  getRuntimeContentRouteParentPage: mockGetParentPage,
}));

const routeRows = [
  {
    description: "Draft",
    markdown: false,
    route: "articles/politics/draft",
    section: "articles",
    title: "Draft",
  },
  {
    description: "A short article fixture.",
    markdown: true,
    route: "articles/politics/aaa-short-fixture",
    section: "articles",
    title: "A Short Fixture",
  },
  {
    description: "Power is passed down under the guise of local values.",
    markdown: true,
    route: "articles/politics/dynastic-politics-asian-values",
    section: "articles",
    title: "Dynastic Politics and Asian Values",
  },
  {
    description: "Green Chemistry",
    markdown: true,
    route: "subjects/chemistry/green-chemistry/definition",
    section: "material",
    title: "Definition of Green Chemistry",
  },
  {
    description: "Quran index",
    markdown: true,
    route: "quran/1",
    section: "quran",
    title: "Al-Quran",
  },
];

beforeEach(() => {
  mockGetArtifactPage.mockReset();
  mockGetParentPage.mockReset();
  mockGetArtifactPage.mockImplementation(({ locale, page, section }) =>
    Effect.succeed({
      locale,
      page,
      routeCount: routeRows.length,
      routes: routeRows.filter((route) => route.section === section),
      section,
      syncedAt: 1,
    })
  );
  mockGetParentPage.mockImplementation(({ parentRoute }) =>
    Effect.succeed({
      continueCursor: null,
      isDone: true,
      page: routeRows.filter((row) => row.route.startsWith(`${parentRoute}/`)),
    })
  );
});

describe("llms entries", () => {
  it("classifies supported sections", () => {
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

  it("localizes static site routes", () => {
    const englishCurriculum = getSiteLlmsEntries("en").find(
      (entry) => entry.route === "/curriculum"
    );
    const indonesianCurriculum = getSiteLlmsEntries("id").find(
      (entry) => entry.route === "/kurikulum"
    );

    expect(englishCurriculum).toMatchObject({
      href: `${BASE_URL}/en/curriculum`,
      section: "site",
      title: "Curriculum",
    });
    expect(indonesianCurriculum).toMatchObject({
      href: `${BASE_URL}/id/kurikulum`,
      section: "site",
      title: "Kurikulum",
    });
  });

  it("builds sorted page entries from markdown route rows", async () => {
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
      ]).pipe(Effect.map((groups) => groups.flat()))
    );

    expect(entries.map((entry) => entry.route)).toEqual([
      "/articles/politics/aaa-short-fixture",
      "/articles/politics/dynastic-politics-asian-values",
      "/subjects/chemistry/green-chemistry/definition",
      "/quran/1",
    ]);
    expect(entries[1]).toEqual({
      description: "Power is passed down under the guise of local values.",
      href: `${BASE_URL}/en/articles/politics/dynastic-politics-asian-values.md`,
      route: "/articles/politics/dynastic-politics-asian-values",
      section: "articles",
      segments: ["articles", "politics", "dynastic-politics-asian-values"],
      title: "Dynastic Politics and Asian Values",
    });
    expect(mockGetArtifactPage).toHaveBeenCalledWith({
      locale: "en",
      page: 0,
      section: "articles",
    });
  });

  it("builds bounded article listing entries", async () => {
    const entries = await Effect.runPromise(
      getContentListingLlmsEntries({
        locale: "en",
        route: "articles/politics",
      })
    );

    expect(entries?.map((entry) => entry.route)).toEqual([
      "/articles/politics/aaa-short-fixture",
      "/articles/politics/dynastic-politics-asian-values",
    ]);
    expect(mockGetParentPage).toHaveBeenCalledWith({
      cursor: null,
      kind: "article",
      limit: 100,
      locale: "en",
      order: "date-desc",
      parentRoute: "articles/politics",
      section: "articles",
    });
  });

  it("rejects unsupported listing routes without catalog reads", async () => {
    const routes = [
      "articles",
      "curriculum/merdeka/class-10/mathematics/integral",
    ];

    for (const route of routes) {
      await expect(
        Effect.runPromise(getContentListingLlmsEntries({ locale: "en", route }))
      ).resolves.toBeNull();
    }

    expect(mockGetParentPage).not.toHaveBeenCalled();
  });

  it("returns no entries when an artifact page is missing", async () => {
    mockGetArtifactPage.mockReturnValueOnce(Effect.succeed(null));

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

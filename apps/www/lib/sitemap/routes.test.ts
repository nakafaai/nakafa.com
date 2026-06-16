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
import {
  buildSitemapContentPageRoutes,
  getSitemapPageDescriptor,
  getSitemapPageDescriptors,
  getSitemapRoutes,
} from "@/lib/sitemap/routes";

type RuntimeContentRoute = NonNullable<
  FunctionReturnType<
    typeof api.contents.queries.runtime.getContentRouteArtifactPage
  >
>["routes"][number];

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeContentRouteArtifactPage: vi.fn(),
  getRuntimeContentRouteCounts: vi.fn(),
}));

vi.mock("@/lib/content/runtime", () => ({
  getRuntimeContentRouteArtifactPage:
    runtimeMocks.getRuntimeContentRouteArtifactPage,
  getRuntimeContentRouteCounts: runtimeMocks.getRuntimeContentRouteCounts,
}));

vi.mock("@repo/internationalization/src/routing", async () => {
  const { defaultLocale, locales } = await import("@repo/utilities/locales");

  return {
    routing: { defaultLocale, locales },
  };
});

beforeEach(() => {
  runtimeMocks.getRuntimeContentRouteArtifactPage.mockReset();
  runtimeMocks.getRuntimeContentRouteCounts.mockReset();
  runtimeMocks.getRuntimeContentRouteCounts.mockImplementation(({ locale }) =>
    Effect.succeed(
      locale === "en"
        ? [countRow("en", "articles", 1), countRow("en", "material", 2)]
        : [countRow("id", "quran", 101)]
    )
  );
  runtimeMocks.getRuntimeContentRouteArtifactPage.mockImplementation(
    ({ locale, page, section }) =>
      Effect.succeed({
        locale,
        page,
        routeCount: routeRows.length,
        routes: routeRows.filter(
          (route) => route.locale === locale && route.section === section
        ),
        section,
        syncedAt: 1,
      })
  );
});

describe("sitemap route discovery", () => {
  it("builds stable page descriptors from materialized counts", async () => {
    await expect(getSitemapPageDescriptors()).resolves.toEqual([
      { id: "base" },
      {
        id: "content_en_articles_0",
        locale: "en",
        page: 0,
        section: "articles",
      },
      {
        id: "content_en_material_0",
        locale: "en",
        page: 0,
        section: "material",
      },
      { id: "content_id_quran_0", locale: "id", page: 0, section: "quran" },
      { id: "content_id_quran_1", locale: "id", page: 1, section: "quran" },
    ]);
    expect(
      runtimeMocks.getRuntimeContentRouteArtifactPage
    ).not.toHaveBeenCalled();
  });

  it("parses valid content page ids and rejects malformed ids", () => {
    expect(getSitemapPageDescriptor("content_en_articles_1")).toEqual({
      id: "content_en_articles_1",
      locale: "en",
      page: 1,
      section: "articles",
    });
    expect(getSitemapPageDescriptor(undefined)).toEqual({ id: "base" });
    expect(getSitemapPageDescriptor("content_en_articles")).toBeNull();
    expect(getSitemapPageDescriptor("pages_en_articles_1")).toBeNull();
    expect(getSitemapPageDescriptor("content_fr_articles_1")).toBeNull();
    expect(getSitemapPageDescriptor("content_en_unknown_1")).toBeNull();
    expect(getSitemapPageDescriptor("content_en_articles_bad")).toBeNull();
  });

  it("builds base and content sitemap routes from one materialized page", async () => {
    await expect(getSitemapRoutes()).resolves.toEqual([
      "/",
      "/assessment",
      "/contributor",
      "/curriculum",
      "/privacy-policy",
      "/quran",
      "/search",
      "/security-policy",
      "/terms-of-service",
    ]);

    const routes = await getSitemapRoutes("content_en_material_0");

    expect(routes).toEqual([
      "/assessment/high-school/snbt",
      "/assessment/high-school/snbt/quantitative-knowledge",
      "/assessment/high-school/snbt/quantitative-knowledge/practice",
      "/assessment/high-school/snbt/quantitative-knowledge/practice/set-1",
      "/assessment/high-school/snbt/quantitative-knowledge/try-out-2026",
      "/assessment/high-school/snbt/quantitative-knowledge/try-out-2026/set-1",
      "/assessment/high-school/snbt/quantitative-knowledge/try-out-2026/set-1/question-1",
      "/material/lesson/chemistry/atomic-structure/introduction",
      "/material/lesson/chemistry/green-chemistry/definition",
      "/material/practice/assessment/snbt/quantitative-knowledge/practice",
      "/material/practice/assessment/snbt/quantitative-knowledge/practice/set-1",
      "/material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
      "/material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/question-1",
    ]);
    expect(
      runtimeMocks.getRuntimeContentRouteArtifactPage
    ).toHaveBeenCalledWith({
      locale: "en",
      page: 0,
      section: "material",
    });
  });

  it("returns no sitemap routes for malformed ids and missing artifact pages", async () => {
    await expect(getSitemapRoutes("malformed")).resolves.toEqual([]);

    runtimeMocks.getRuntimeContentRouteArtifactPage.mockReturnValueOnce(
      Effect.succeed(null)
    );

    await expect(getSitemapRoutes("content_en_material_0")).resolves.toEqual(
      []
    );
  });

  it("derives parent routes from concrete route catalog rows", () => {
    expect(buildSitemapContentPageRoutes(routeRows)).toEqual([
      "/articles/politics",
      "/articles/politics/dynastic-politics-asian-values",
      "/assessment/high-school/snbt",
      "/assessment/high-school/snbt/quantitative-knowledge",
      "/assessment/high-school/snbt/quantitative-knowledge/practice",
      "/assessment/high-school/snbt/quantitative-knowledge/practice/set-1",
      "/assessment/high-school/snbt/quantitative-knowledge/try-out-2026",
      "/assessment/high-school/snbt/quantitative-knowledge/try-out-2026/set-1",
      "/assessment/high-school/snbt/quantitative-knowledge/try-out-2026/set-1/question-1",
      "/material/lesson/chemistry/atomic-structure/introduction",
      "/material/lesson/chemistry/green-chemistry/definition",
      "/material/practice/assessment/snbt/quantitative-knowledge/practice",
      "/material/practice/assessment/snbt/quantitative-knowledge/practice/set-1",
      "/material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
      "/material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/question-1",
      "/quran/1",
    ]);
  });

  it("does not create assessment try-out parents without a year segment", () => {
    expect(
      buildSitemapContentPageRoutes([
        routeRow({
          locale: "en",
          route:
            "material/practice/assessment/snbt/quantitative-knowledge/try-out/set-1",
          section: "material",
        }),
      ])
    ).toEqual([
      "/assessment/high-school/snbt",
      "/assessment/high-school/snbt/quantitative-knowledge",
      "/material/practice/assessment/snbt/quantitative-knowledge/try-out/set-1",
    ]);
  });

  it("skips incomplete or unsupported route projections", () => {
    expect(buildSitemapContentPageRoutes(incompleteRouteRows)).toEqual([]);
  });
});

const routeRows = [
  routeRow({
    locale: "en",
    route: "articles/politics/dynastic-politics-asian-values",
    section: "articles",
  }),
  routeRow({
    locale: "en",
    route: "material/lesson/chemistry/green-chemistry/definition",
    section: "material",
  }),
  routeRow({
    locale: "en",
    route: "material/lesson/chemistry/atomic-structure/introduction",
    section: "material",
  }),
  routeRow({
    locale: "en",
    route:
      "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
    section: "material",
  }),
  routeRow({
    locale: "en",
    route:
      "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/question-1",
    section: "material",
  }),
  routeRow({
    locale: "en",
    route: "material/practice/assessment/snbt/quantitative-knowledge/practice",
    section: "material",
  }),
  routeRow({
    locale: "en",
    route:
      "material/practice/assessment/snbt/quantitative-knowledge/practice/set-1",
    section: "material",
  }),
  routeRow({
    locale: "en",
    route: "quran/1",
    section: "quran",
  }),
];

const incompleteRouteRows = [
  routeProjectionRow(
    {
      locale: "en",
      route: "articles/politics/dynastic-politics-asian-values",
      section: "articles",
    },
    "articles/politics"
  ),
  routeProjectionRow(
    {
      locale: "en",
      route: "material/lesson/chemistry/green-chemistry/definition",
      section: "material",
    },
    "curriculum/high-school/10/chemistry"
  ),
  routeProjectionRow(
    {
      locale: "en",
      route:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
      section: "material",
    },
    "assessment/high-school/snbt/quantitative-knowledge"
  ),
  routeProjectionRow(
    {
      locale: "en",
      route: "articles/politics/dynastic-politics-asian-values",
      section: "articles",
    },
    "unknown/path"
  ),
];

/** Builds one route-count fixture row for sitemap descriptor tests. */
function countRow(locale: Locale, section: SourceRegistryRoot, count: number) {
  return { count, locale, section, syncedAt: 1 };
}

/** Builds one route-catalog fixture row for sitemap tests. */
function routeRow({
  locale,
  route,
  section,
}: {
  locale: Locale;
  route: string;
  section: SourceRegistryRoot;
}): RuntimeContentRoute {
  const graph = routeGraph(locale, route);
  const kind = getLearningObjectKindForRoute(route);

  if (!kind) {
    throw new Error(`Expected graph route kind for ${route}.`);
  }

  return {
    ...graph,
    authors: [{ name: "Nakafa" }],
    date: 1_735_689_600_000,
    description: "Description",
    kind,
    locale,
    markdown: true,
    official: false,
    route,
    section,
    syncedAt: 1,
    title: "Title",
  };
}

/** Builds a graph-backed row with a custom route projection for edge cases. */
function routeProjectionRow(
  input: {
    locale: Locale;
    route: string;
    section: SourceRegistryRoot;
  },
  route: string
): RuntimeContentRoute {
  return {
    ...routeRow(input),
    route,
  };
}

/** Builds graph identity fields for a sitemap route fixture. */
function routeGraph(locale: Locale, route: string) {
  const identity = createLearningGraphIdentityFromRoute({ locale, route });

  if (!identity) {
    throw new Error(`Expected graph identity for ${route}.`);
  }

  return {
    ...identity,
    content_id: identity.assetId,
  };
}

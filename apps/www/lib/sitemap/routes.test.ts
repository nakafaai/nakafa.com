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
type RuntimeSitemapPublicRoute = FunctionReturnType<
  typeof api.contents.queries.runtime.listSitemapPublicRoutes
>["page"][number];

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeContentRouteArtifactPage: vi.fn(),
  getRuntimeContentRouteCounts: vi.fn(),
  getRuntimeSitemapPublicRoutes: vi.fn(),
}));

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRouteArtifactPage:
    runtimeMocks.getRuntimeContentRouteArtifactPage,
  getRuntimeContentRouteCounts: runtimeMocks.getRuntimeContentRouteCounts,
  getRuntimeSitemapPublicRoutes: runtimeMocks.getRuntimeSitemapPublicRoutes,
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
  runtimeMocks.getRuntimeSitemapPublicRoutes.mockReset();
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
  runtimeMocks.getRuntimeSitemapPublicRoutes.mockImplementation(
    ({ cursor, locale }) =>
      Effect.succeed({
        continueCursor: "",
        isDone: true,
        page:
          cursor === null
            ? publicRouteRows.filter((route) => route.locale === locale)
            : [],
      })
  );
});

describe("sitemap route discovery", () => {
  it("builds stable page descriptors from materialized counts", async () => {
    await expect(getSitemapPageDescriptors()).resolves.toEqual([
      { id: "base" },
      { id: "public_en", kind: "public", locale: "en" },
      {
        id: "content_en_articles_0",
        kind: "content",
        locale: "en",
        page: 0,
        section: "articles",
      },
      {
        id: "content_en_material_0",
        kind: "content",
        locale: "en",
        page: 0,
        section: "material",
      },
      { id: "public_id", kind: "public", locale: "id" },
      {
        id: "content_id_quran_0",
        kind: "content",
        locale: "id",
        page: 0,
        section: "quran",
      },
      {
        id: "content_id_quran_1",
        kind: "content",
        locale: "id",
        page: 1,
        section: "quran",
      },
    ]);
    expect(
      runtimeMocks.getRuntimeContentRouteArtifactPage
    ).not.toHaveBeenCalled();
  });

  it("parses valid content page ids and rejects malformed ids", () => {
    expect(getSitemapPageDescriptor("content_en_articles_1")).toEqual({
      id: "content_en_articles_1",
      kind: "content",
      locale: "en",
      page: 1,
      section: "articles",
    });
    expect(getSitemapPageDescriptor("public_en")).toEqual({
      id: "public_en",
      kind: "public",
      locale: "en",
    });
    expect(getSitemapPageDescriptor(undefined)).toEqual({ id: "base" });
    expect(getSitemapPageDescriptor("content_en_articles")).toBeNull();
    expect(getSitemapPageDescriptor("pages_en_articles_1")).toBeNull();
    expect(getSitemapPageDescriptor("content_fr_articles_1")).toBeNull();
    expect(getSitemapPageDescriptor("content_en_unknown_1")).toBeNull();
    expect(getSitemapPageDescriptor("content_en_articles_bad")).toBeNull();
    expect(getSitemapPageDescriptor("public_en_extra")).toBeNull();
  });

  it("builds base, content, and public sitemap routes from bounded pages", async () => {
    await expect(getSitemapRoutes()).resolves.toEqual([
      "/",
      "/contributor",
      "/privacy-policy",
      "/quran",
      "/search",
      "/security-policy",
      "/terms-of-service",
    ]);

    const routes = await getSitemapRoutes("content_en_material_0");

    expect(routes).toEqual([
      "/practice/snbt",
      "/practice/snbt/quantitative-knowledge",
      "/practice/snbt/quantitative-knowledge/mock-test-2026/set-1",
      "/practice/snbt/quantitative-knowledge/mock-test-2026/set-1/question-1",
      "/subjects/chemistry/green-chemistry/definition",
    ]);
    expect(
      runtimeMocks.getRuntimeContentRouteArtifactPage
    ).toHaveBeenCalledWith({
      locale: "en",
      page: 0,
      section: "material",
    });

    await expect(getSitemapRoutes("public_en")).resolves.toEqual([
      "/curriculum/merdeka/class-10/mathematics",
      "/exams/snbt/quantitative-knowledge",
    ]);
    expect(runtimeMocks.getRuntimeSitemapPublicRoutes).toHaveBeenCalledWith({
      cursor: null,
      limit: 100,
      locale: "en",
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

  it("walks bounded public route pages until the runtime cursor is done", async () => {
    runtimeMocks.getRuntimeSitemapPublicRoutes.mockImplementation(
      ({ cursor, locale }) =>
        Effect.succeed({
          continueCursor: cursor === null ? "next" : "",
          isDone: cursor !== null,
          page:
            cursor === null
              ? publicRouteRows
                  .filter((route) => route.locale === locale)
                  .slice(0, 1)
              : publicRouteRows
                  .filter((route) => route.locale === locale)
                  .slice(1),
        })
    );

    await expect(getSitemapRoutes("public_en")).resolves.toEqual([
      "/curriculum/merdeka/class-10/mathematics",
      "/exams/snbt/quantitative-knowledge",
    ]);
    expect(runtimeMocks.getRuntimeSitemapPublicRoutes).toHaveBeenLastCalledWith(
      {
        cursor: "next",
        limit: 100,
        locale: "en",
      }
    );
  });

  it("derives parent routes from concrete route catalog rows", async () => {
    await expect(
      Effect.runPromise(buildSitemapContentPageRoutes(routeRows))
    ).resolves.toEqual([
      "/articles/politics",
      "/articles/politics/dynastic-politics-asian-values",
      "/practice/snbt",
      "/practice/snbt/quantitative-knowledge",
      "/practice/snbt/quantitative-knowledge/mock-test-2026/set-1",
      "/practice/snbt/quantitative-knowledge/mock-test-2026/set-1/question-1",
      "/quran/1",
      "/subjects/chemistry/green-chemistry/definition",
    ]);
  });

  it("does not create public practice routes for stale source paths", async () => {
    await expect(
      Effect.runPromise(
        buildSitemapContentPageRoutes([
          routeProjectionRow(
            {
              locale: "en",
              route:
                "practice/snbt/quantitative-knowledge/mock-test-2026/set-1",
              section: "material",
            },
            "material/practice/assessment/snbt/quantitative-knowledge/try-out/set-1"
          ),
        ])
      )
    ).resolves.toEqual([]);
  });

  it("skips incomplete or unsupported route projections", async () => {
    await expect(
      Effect.runPromise(buildSitemapContentPageRoutes(incompleteRouteRows))
    ).resolves.toEqual([]);
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
    route: "subjects/chemistry/green-chemistry/definition",
    section: "material",
    sourcePath: "material/lesson/chemistry/green-chemistry/definition",
  }),
  routeRow({
    locale: "en",
    route: "subjects/chemistry/green-chemistry",
    section: "material",
    sourcePath: "material/lesson/chemistry/green-chemistry",
  }),
  routeRow({
    locale: "en",
    route: "practice/snbt/quantitative-knowledge/mock-test-2026/set-1",
    section: "material",
    sourcePath:
      "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
  }),
  routeRow({
    locale: "en",
    route:
      "practice/snbt/quantitative-knowledge/mock-test-2026/set-1/question-1",
    section: "material",
    sourcePath:
      "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/1",
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
      route: "subjects/chemistry/green-chemistry/definition",
      section: "material",
    },
    "material/lesson/chemistry/green-chemistry/unknown-section"
  ),
  routeProjectionRow(
    {
      locale: "en",
      route: "practice/snbt/quantitative-knowledge/mock-test-2026/set-1",
      section: "material",
    },
    "material/practice/assessment/snbt/quantitative-knowledge/try-out-2027/set-1"
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
  sourcePath = route,
}: {
  locale: Locale;
  route: string;
  section: SourceRegistryRoot;
  sourcePath?: string;
}): RuntimeContentRoute {
  const graph = routeGraph(locale, sourcePath);
  const kind = getLearningObjectKindForRoute(sourcePath);

  if (!kind) {
    throw new Error(`Expected graph route kind for ${sourcePath}.`);
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
    sourcePath,
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
  sourcePath: string
): RuntimeContentRoute {
  return {
    ...routeRow({ ...input, sourcePath }),
    sourcePath,
  };
}

const publicRouteRows: RuntimeSitemapPublicRoute[] = [
  {
    canonicalPath: undefined,
    description: undefined,
    displayGroupIconKey: undefined,
    displayGroupTitle: undefined,
    iconKey: "mathematics",
    kind: "curriculum-context",
    locale: "en",
    materialDomain: "mathematics",
    materialKey: "lesson.mathematics.integral",
    nodeKey: "merdeka.class-10.mathematics",
    order: 1,
    parentPath: "curriculum/merdeka/class-10",
    programKey: "merdeka",
    publicPath: "curriculum/merdeka/class-10/mathematics",
    sectionKey: undefined,
    sitemap: true,
    sourcePath: undefined,
    syncedAt: 1,
    title: "Mathematics",
  },
  {
    canonicalPath: "practice/snbt/quantitative-knowledge",
    description: undefined,
    displayGroupIconKey: undefined,
    displayGroupTitle: undefined,
    iconKey: "assessment",
    kind: "assessment-context",
    locale: "en",
    materialDomain: undefined,
    materialKey: "practice.assessment.snbt.quantitative-knowledge",
    nodeKey: "snbt.quantitative-knowledge",
    order: 1,
    parentPath: "exams/snbt",
    programKey: "snbt-2026",
    publicPath: "exams/snbt/quantitative-knowledge",
    sectionKey: undefined,
    sitemap: true,
    sourcePath: undefined,
    syncedAt: 1,
    title: "Quantitative Knowledge",
  },
  {
    canonicalPath: undefined,
    description: undefined,
    displayGroupIconKey: undefined,
    displayGroupTitle: undefined,
    iconKey: undefined,
    kind: "subject-lesson",
    locale: "en",
    materialDomain: "mathematics",
    materialKey: "lesson.mathematics.integral",
    nodeKey: undefined,
    order: 1,
    parentPath: "subjects/mathematics/integral",
    programKey: undefined,
    publicPath: "subjects/mathematics/integral/area",
    sectionKey: undefined,
    sitemap: true,
    sourcePath: "material/lesson/mathematics/integral/area",
    syncedAt: 1,
    title: "Area",
  },
];

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

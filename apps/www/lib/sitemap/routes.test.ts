// @vitest-environment node

import type { api } from "@repo/backend/convex/_generated/api";
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

vi.mock("@repo/internationalization/src/routing", () => ({
  routing: {
    defaultLocale: "en",
    locales: ["en", "id"],
  },
}));

beforeEach(() => {
  runtimeMocks.getRuntimeContentRouteArtifactPage.mockReset();
  runtimeMocks.getRuntimeContentRouteCounts.mockReset();
  runtimeMocks.getRuntimeContentRouteCounts.mockImplementation(({ locale }) =>
    Effect.succeed(
      locale === "en"
        ? [countRow("en", "articles", 1), countRow("en", "subject", 2)]
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
      { id: "content_en_subject_0", locale: "en", page: 0, section: "subject" },
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
      "/contributor",
      "/privacy-policy",
      "/quran",
      "/search",
      "/security-policy",
      "/subject",
      "/terms-of-service",
    ]);

    const routes = await getSitemapRoutes("content_en_subject_0");

    expect(routes).toEqual([
      "/subject/high-school/10",
      "/subject/high-school/10/chemistry",
      "/subject/high-school/10/chemistry/atomic-structure/introduction",
      "/subject/high-school/10/chemistry/green-chemistry/definition",
    ]);
    expect(
      runtimeMocks.getRuntimeContentRouteArtifactPage
    ).toHaveBeenCalledWith({
      locale: "en",
      page: 0,
      section: "subject",
    });
  });

  it("returns no sitemap routes for malformed ids and missing artifact pages", async () => {
    await expect(getSitemapRoutes("malformed")).resolves.toEqual([]);

    runtimeMocks.getRuntimeContentRouteArtifactPage.mockReturnValueOnce(
      Effect.succeed(null)
    );

    await expect(getSitemapRoutes("content_en_subject_0")).resolves.toEqual([]);
  });

  it("derives parent routes from concrete route catalog rows", () => {
    expect(buildSitemapContentPageRoutes(routeRows)).toEqual([
      "/articles/politics",
      "/articles/politics/dynastic-politics-asian-values",
      "/exercises/high-school/snbt",
      "/exercises/high-school/snbt/quantitative-knowledge",
      "/exercises/high-school/snbt/quantitative-knowledge/practice",
      "/exercises/high-school/snbt/quantitative-knowledge/practice/set-1",
      "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
      "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
      "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1",
      "/quran/1",
      "/subject/high-school/10",
      "/subject/high-school/10/chemistry",
      "/subject/high-school/10/chemistry/atomic-structure/introduction",
      "/subject/high-school/10/chemistry/green-chemistry/definition",
    ]);

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
    route: "subject/high-school/10/chemistry/green-chemistry/definition",
    section: "subject",
  }),
  routeRow({
    locale: "en",
    route: "subject/high-school/10/chemistry/atomic-structure/introduction",
    section: "subject",
  }),
  routeRow({
    locale: "en",
    route:
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
    section: "exercises",
  }),
  routeRow({
    locale: "en",
    route:
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1",
    section: "exercises",
  }),
  routeRow({
    locale: "en",
    route: "exercises/high-school/snbt/quantitative-knowledge/practice/set-1",
    section: "exercises",
  }),
  routeRow({
    locale: "en",
    route: "quran/1",
    section: "quran",
  }),
];

const incompleteRouteRows = [
  routeRow({
    locale: "en",
    route: "articles/politics",
    section: "articles",
  }),
  routeRow({
    locale: "en",
    route: "subject/high-school/10/chemistry",
    section: "subject",
  }),
  routeRow({
    locale: "en",
    route: "exercises/high-school/snbt/quantitative-knowledge",
    section: "exercises",
  }),
  routeRow({
    locale: "en",
    route: "unknown/path",
    section: "articles",
  }),
];

/** Builds one route-count fixture row for sitemap descriptor tests. */
function countRow(
  locale: "en" | "id",
  section: "articles" | "subject" | "exercises" | "quran",
  count: number
) {
  return { count, locale, section, syncedAt: 1 };
}

/** Builds one route-catalog fixture row for sitemap tests. */
function routeRow({
  locale,
  route,
  section,
}: {
  locale: "en" | "id";
  route: string;
  section: "articles" | "subject" | "exercises" | "quran";
}): RuntimeContentRoute {
  return {
    authors: [{ name: "Nakafa" }],
    content_id: `${locale}/${route}`,
    date: 1_735_689_600_000,
    description: "Description",
    kind: "article",
    locale,
    markdown: true,
    official: false,
    route,
    section,
    syncedAt: 1,
    title: "Title",
  };
}

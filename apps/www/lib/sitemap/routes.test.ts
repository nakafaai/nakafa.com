// @vitest-environment node

import type { api } from "@repo/backend/convex/_generated/api";
import type { Locale } from "@repo/contents/_types/content";
import { getSourceRouteProjectionForRoute } from "@repo/contents/_types/graph/projection";
import type { SourceRegistryRoot } from "@repo/contents/_types/graph/schema";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSitemapPageDescriptor,
  readSitemapPageDescriptors,
  readSitemapRoutePage,
} from "@/lib/sitemap/routes";

type RuntimeContentRoute = NonNullable<
  FunctionReturnType<typeof api.contents.queries.runtime.getContentSitemapPage>
>["routes"][number];

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeContentRouteCounts: vi.fn(),
  getRuntimeContentSitemapPage: vi.fn(),
  getRuntimePublicSitemapCount: vi.fn(),
  getRuntimePublicSitemapPage: vi.fn(),
}));

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRouteCounts: runtimeMocks.getRuntimeContentRouteCounts,
  getRuntimeContentSitemapPage: runtimeMocks.getRuntimeContentSitemapPage,
  getRuntimePublicSitemapCount: runtimeMocks.getRuntimePublicSitemapCount,
  getRuntimePublicSitemapPage: runtimeMocks.getRuntimePublicSitemapPage,
}));

vi.mock("@repo/internationalization/src/routing", async () => {
  const { defaultLocale, locales } = await import("@repo/utilities/locales");

  return {
    routing: { defaultLocale, locales },
  };
});

beforeEach(() => {
  runtimeMocks.getRuntimeContentRouteCounts.mockReset();
  runtimeMocks.getRuntimeContentSitemapPage.mockReset();
  runtimeMocks.getRuntimePublicSitemapCount.mockReset();
  runtimeMocks.getRuntimePublicSitemapPage.mockReset();
  runtimeMocks.getRuntimeContentRouteCounts.mockImplementation(({ locale }) =>
    Effect.succeed(
      locale === "en"
        ? [
            countRow("en", "articles", 1),
            countRow("en", "material", 2),
            countRow("en", "tryout", 2),
          ]
        : [countRow("id", "quran", 101)]
    )
  );
  runtimeMocks.getRuntimeContentSitemapPage.mockImplementation(({ section }) =>
    Effect.succeed({
      routes: routeRows.filter((route) => route.section === section),
    })
  );
  runtimeMocks.getRuntimePublicSitemapCount.mockReturnValue(
    Effect.succeed({ count: 1, pageCount: 1 })
  );
  runtimeMocks.getRuntimePublicSitemapPage.mockImplementation(({ locale }) =>
    Effect.succeed({
      paths:
        locale === "en"
          ? ["curriculum/merdeka/class-10/mathematics"]
          : ["kurikulum/merdeka/kelas-10/matematika"],
      syncedAt: 1_735_689_600_000,
    })
  );
});

describe("sitemap route discovery", () => {
  it("builds stable page descriptors from materialized counts", async () => {
    await expect(
      Effect.runPromise(readSitemapPageDescriptors())
    ).resolves.toEqual([
      { id: "base" },
      { id: "public_en_0", kind: "public", locale: "en", page: 0 },
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
      {
        id: "content_en_tryout_0",
        kind: "content",
        locale: "en",
        page: 0,
        section: "tryout",
      },
      { id: "public_id_0", kind: "public", locale: "id", page: 0 },
      {
        id: "content_id_quran_0",
        kind: "content",
        locale: "id",
        page: 0,
        section: "quran",
      },
    ]);
    expect(runtimeMocks.getRuntimeContentSitemapPage).not.toHaveBeenCalled();
  });

  it("parses valid content page ids and rejects malformed ids", () => {
    expect(getSitemapPageDescriptor("content_en_articles_1")).toEqual({
      id: "content_en_articles_1",
      kind: "content",
      locale: "en",
      page: 1,
      section: "articles",
    });
    expect(getSitemapPageDescriptor("public_en_1")).toEqual({
      id: "public_en_1",
      kind: "public",
      locale: "en",
      page: 1,
    });
    expect(getSitemapPageDescriptor("content_en_articles_01")).toBeNull();
    expect(getSitemapPageDescriptor("public_en")).toBeNull();
    expect(getSitemapPageDescriptor("public_en_invalid")).toBeNull();
    expect(getSitemapPageDescriptor("public_en_")).toBeNull();
    expect(getSitemapPageDescriptor("pages_en_articles_1")).toBeNull();
    expect(getSitemapPageDescriptor("content_en_unknown_1")).toBeNull();
  });

  it("builds base, content, and public sitemap routes from bounded pages", async () => {
    await expect(readPaths("base")).resolves.toEqual([
      "/",
      "/contributor",
      "/curricula",
      "/privacy-policy",
      "/quran",
      "/search",
      "/security-policy",
      "/terms-of-service",
    ]);

    const routes = await readPaths("content_en_material_0");

    expect(routes).toEqual(["/subjects/chemistry/green-chemistry/definition"]);
    expect(runtimeMocks.getRuntimeContentSitemapPage).toHaveBeenCalledWith({
      locale: "en",
      page: 0,
      section: "material",
    });

    await expect(readPaths("content_en_tryout_0")).resolves.toEqual([
      "/try-out/indonesia/snbt/2027/set-1",
      "/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
    ]);

    const publicPage = await Effect.runPromise(
      readSitemapRoutePage("public_en_0")
    );

    expect(publicPage.routes).toEqual([
      {
        lastModified: 1_735_689_600_000,
        path: "/curriculum/merdeka/class-10/mathematics",
      },
    ]);
    expect(runtimeMocks.getRuntimePublicSitemapPage).toHaveBeenCalledWith({
      locale: "en",
      page: 0,
    });
  });

  it("fails when the sitemap id or materialized page does not exist", async () => {
    await expect(
      Effect.runPromise(Effect.flip(readSitemapRoutePage("malformed")))
    ).resolves.toMatchObject({
      _tag: "SitemapPageNotFoundError",
      pageId: "malformed",
    });

    runtimeMocks.getRuntimeContentSitemapPage.mockReturnValueOnce(
      Effect.succeed(null)
    );

    await expect(
      Effect.runPromise(
        Effect.flip(readSitemapRoutePage("content_en_material_0"))
      )
    ).resolves.toMatchObject({
      _tag: "SitemapPageNotFoundError",
      pageId: "content_en_material_0",
    });

    runtimeMocks.getRuntimePublicSitemapPage.mockReturnValueOnce(
      Effect.succeed(null)
    );

    await expect(
      Effect.runPromise(Effect.flip(readSitemapRoutePage("public_en_0")))
    ).resolves.toMatchObject({
      _tag: "SitemapPageNotFoundError",
      pageId: "public_en_0",
    });
  });

  it("groups one thousand content rows into one XML descriptor", async () => {
    runtimeMocks.getRuntimeContentRouteCounts.mockImplementation(({ locale }) =>
      Effect.succeed(locale === "en" ? [countRow("en", "material", 1001)] : [])
    );
    runtimeMocks.getRuntimePublicSitemapCount.mockReturnValue(
      Effect.succeed(null)
    );

    const descriptors = await Effect.runPromise(readSitemapPageDescriptors());

    expect(descriptors).toEqual([
      { id: "base" },
      {
        id: "content_en_material_0",
        kind: "content",
        locale: "en",
        page: 0,
        section: "material",
      },
      {
        id: "content_en_material_1",
        kind: "content",
        locale: "en",
        page: 1,
        section: "material",
      },
    ]);
  });
});

/** Reads only path strings from one sitemap route page. */
async function readPaths(pageId: string) {
  const page = await Effect.runPromise(readSitemapRoutePage(pageId));
  return page.routes.map((route) => route.path);
}

const routeRows = [
  routeRow({
    locale: "en",
    route: "subjects/chemistry/green-chemistry/definition",
    section: "material",
    sourcePath: "material/lesson/chemistry/green-chemistry/definition",
  }),
  routeRow({
    locale: "en",
    route: "try-out/indonesia/snbt/2027/set-1",
    section: "tryout",
  }),
  routeRow({
    locale: "en",
    route: "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
    section: "tryout",
  }),
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
  const kind = getSourceRouteProjectionForRoute(sourcePath, locale)?.kind;

  if (!kind) {
    throw new Error(`Expected graph route kind for ${sourcePath}.`);
  }

  return {
    date: 1_735_689_600_000,
    kind,
    route,
    section,
    syncedAt: 1,
  };
}

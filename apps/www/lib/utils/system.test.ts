// @vitest-environment node
import type { Locale } from "@repo/contents/_types/content";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import type { SourceRegistryRoot } from "@repo/contents/_types/source-registry";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCachedMetadataFromSlug,
  getMetadataFromSlug,
  getStaticParams,
} from "@/lib/utils/system";

const routeMocks = vi.hoisted(() => ({
  listRuntimeLatestContentRoutes: vi.fn(),
}));
const cacheMocks = vi.hoisted(() => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
const runtimeMocks = vi.hoisted(() => ({
  getRuntimeContentRoute: vi.fn(),
}));
const translationMocks = vi.hoisted(() => ({
  getTranslations: vi.fn(),
}));

vi.mock("@repo/internationalization/src/routing", async () => {
  const { defaultLocale, locales } = await import("@repo/utilities/locales");

  return {
    routing: { defaultLocale, locales },
  };
});

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRoute: runtimeMocks.getRuntimeContentRoute,
  listRuntimeLatestContentRoutes: routeMocks.listRuntimeLatestContentRoutes,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: translationMocks.getTranslations,
}));

vi.mock("next/cache", () => ({
  cacheLife: cacheMocks.cacheLife,
  cacheTag: cacheMocks.cacheTag,
}));

beforeEach(() => {
  routeMocks.listRuntimeLatestContentRoutes.mockReset();
  cacheMocks.cacheLife.mockClear();
  cacheMocks.cacheTag.mockClear();
  runtimeMocks.getRuntimeContentRoute.mockReset();
  translationMocks.getTranslations.mockReset();

  routeMocks.listRuntimeLatestContentRoutes.mockImplementation(
    ({ locale, section }: RuntimeRouteArgs) =>
      Effect.succeed(
        routeRows.filter(
          (route) => route.locale === locale && route.section === section
        )
      )
  );
  runtimeMocks.getRuntimeContentRoute.mockReturnValue(
    Effect.succeed({
      authors: [{ name: "Nakafa" }],
      date: new Date("2025-01-02").getTime(),
      description: "Runtime description",
      title: "Runtime title",
    })
  );
  translationMocks.getTranslations.mockImplementation(({ namespace }) => {
    if (namespace === "Common") {
      return Promise.resolve((key: string) =>
        key === "made-with-love" ? "Made with love" : key
      );
    }

    return Promise.resolve((key: string) =>
      key === "short-description" ? "Short description" : key
    );
  });
});

describe("route catalog static params", () => {
  it("builds shallow static params from Convex-backed public routes", async () => {
    await expect(
      getStaticParams({
        basePath: "articles",
        paramNames: ["category"],
      })
    ).resolves.toEqual([{ category: "politics" }]);

    await expect(
      getStaticParams({
        basePath: "material",
        paramNames: ["category", "grade", "material"],
      })
    ).resolves.toContainEqual({
      category: "lesson",
      grade: "chemistry",
      material: "green-chemistry",
    });
    expect(routeMocks.listRuntimeLatestContentRoutes).toHaveBeenCalledWith({
      limit: 100,
      locale: "en",
      section: "articles",
    });
    expect(routeMocks.listRuntimeLatestContentRoutes).toHaveBeenCalledWith({
      limit: 100,
      locale: "id",
      section: "material",
    });
  });

  it("builds deep slug params from Convex-backed public routes", async () => {
    await expect(
      getStaticParams({
        basePath: "material",
        isDeep: true,
        paramNames: ["category", "grade", "material", "slug"],
        slugParam: "slug",
      })
    ).resolves.toContainEqual({
      category: "lesson",
      grade: "chemistry",
      material: "green-chemistry",
      slug: ["definition"],
    });
  });

  it("skips malformed or nonmatching static-param routes", async () => {
    routeMocks.listRuntimeLatestContentRoutes.mockReturnValueOnce(
      Effect.succeed([
        routeRow({
          locale: "en",
          route: "articles",
          section: "articles",
        }),
        routeRow({
          locale: "en",
          route: "curriculum/merdeka/class-10/chemistry",
          section: "material",
        }),
        routeRow({
          locale: "en",
          route: "articles/politics",
          section: "articles",
        }),
        routeRow({
          locale: "en",
          route: "articles/politics/example",
          section: "articles",
        }),
      ])
    );
    routeMocks.listRuntimeLatestContentRoutes.mockReturnValueOnce(
      Effect.succeed([])
    );

    await expect(
      getStaticParams({
        basePath: "articles",
        isDeep: true,
        paramNames: ["category", "slug"],
        slugParam: "slug",
      })
    ).resolves.toEqual([
      {
        category: "politics",
        slug: ["example"],
      },
    ]);
  });
});

const routeRows = [
  routeRow({
    locale: "en",
    route: "articles/politics/dynastic-politics-asian-values",
    section: "articles",
  }),
  routeRow({
    locale: "id",
    route: "articles/politics/dynastic-politics-asian-values",
    section: "articles",
  }),
  routeRow({
    locale: "en",
    route: "material/lesson/chemistry/green-chemistry/definition",
    section: "material",
  }),
  routeRow({
    locale: "id",
    route: "material/lesson/chemistry/green-chemistry/definition",
    section: "material",
  }),
  routeRow({
    kind: "tryout-section",
    locale: "en",
    parentRoute: "try-out/indonesia/snbt/set-1",
    route: "try-out/indonesia/snbt/set-1/quantitative-knowledge",
    section: "tryout",
  }),
];

interface RuntimeRouteArgs {
  locale: Locale;
  section: SourceRegistryRoot;
}

interface RuntimeRouteFixture {
  kind?: string;
  locale: RuntimeRouteArgs["locale"];
  parentRoute?: string;
  route: string;
  section: RuntimeRouteArgs["section"];
}

/** Builds one route row with only the fields static-param tests read. */
function routeRow(args: RuntimeRouteFixture) {
  return {
    authors: [{ name: "Nakafa" }],
    content_id: getFixtureContentId(args.locale, args.route),
    kind: args.kind ?? "article",
    locale: args.locale,
    markdown: true,
    parentRoute: args.parentRoute,
    route: args.route,
    section: args.section,
    syncedAt: 1,
    title: "Title",
  };
}

/** Builds the graph asset ID used by synced route rows in fixture data. */
function getFixtureContentId(locale: Locale, route: string) {
  const identity = createLearningGraphIdentityFromRoute({ locale, route });

  if (identity) {
    return identity.assetId;
  }

  return `asset:${locale}:fixture:${route.split("/").filter(Boolean).join(":")}`;
}

describe("route catalog metadata", () => {
  it("reads OG metadata from the Convex route catalog", async () => {
    await expect(
      Effect.runPromise(
        getMetadataFromSlug("en", [
          "articles",
          "politics",
          "dynastic-politics-asian-values",
        ])
      )
    ).resolves.toEqual({
      authors: [{ name: "Nakafa" }],
      date: "2025-01-02T00:00:00.000Z",
      description: "Runtime description",
      title: "Runtime title",
    });
  });

  it("falls back to translated defaults when no route metadata exists", async () => {
    runtimeMocks.getRuntimeContentRoute.mockReturnValueOnce(
      Effect.succeed(null)
    );

    await expect(
      Effect.runPromise(getMetadataFromSlug("id", ["articles", "missing"]))
    ).resolves.toEqual({
      authors: [{ name: "Nakafa" }],
      date: "",
      description: "Short description",
      title: "Made with love",
    });
  });

  it("falls back to translated defaults when route metadata lookup fails", async () => {
    runtimeMocks.getRuntimeContentRoute.mockReturnValueOnce(
      Effect.fail(new Error("Route catalog unavailable."))
    );

    await expect(
      Effect.runPromise(getMetadataFromSlug("id", ["articles", "failed"]))
    ).resolves.toEqual({
      authors: [{ name: "Nakafa" }],
      date: "",
      description: "Short description",
      title: "Made with love",
    });
  });

  it("uses translation defaults for sparse route metadata", async () => {
    runtimeMocks.getRuntimeContentRoute.mockReturnValueOnce(
      Effect.succeed({
        authors: [{ name: "Nakafa" }],
        date: undefined,
        description: undefined,
        title: "",
      })
    );

    await expect(
      Effect.runPromise(getMetadataFromSlug("en", ["articles", "sparse"]))
    ).resolves.toEqual({
      authors: [{ name: "Nakafa" }],
      date: "",
      description: "Short description",
      title: "Made with love",
    });
  });

  it("fails with a typed error when metadata translations cannot load", async () => {
    translationMocks.getTranslations.mockRejectedValueOnce(
      new Error("Missing Common translations.")
    );

    await expect(
      Effect.runPromise(getMetadataFromSlug("en", ["articles", "example"]))
    ).rejects.toThrow('"namespace": "Common"');

    translationMocks.getTranslations.mockImplementation(({ namespace }) => {
      if (namespace === "Common") {
        return Promise.resolve((key: string) =>
          key === "made-with-love" ? "Made with love" : key
        );
      }

      return Promise.reject(new Error("Missing Metadata translations."));
    });

    await expect(
      Effect.runPromise(getMetadataFromSlug("en", ["articles", "example"]))
    ).rejects.toThrow('"namespace": "Metadata"');
  });

  it("uses the cached metadata helper for route handlers", async () => {
    await expect(
      getCachedMetadataFromSlug("en", ["articles", "politics", "example"])
    ).resolves.toMatchObject({
      description: "Runtime description",
      title: "Runtime title",
    });
    expect(cacheMocks.cacheTag).toHaveBeenCalledWith("content-runtime");
    expect(cacheMocks.cacheLife).toHaveBeenCalledWith("contentRuntime");
  });
});

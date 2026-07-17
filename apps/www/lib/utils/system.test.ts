// @vitest-environment node

import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import type { Locale } from "@repo/contents/_types/content";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCachedMetadataFromSlug,
  getMetadataFromSlug,
  getStaticParams,
} from "@/lib/utils/system";

const routeMocks = vi.hoisted(() => ({
  listLatest: vi.fn(),
  read: vi.fn(),
}));
const cacheMocks = vi.hoisted(() => ({
  life: vi.fn(),
  tag: vi.fn(),
}));
const mockGetTranslations = vi.hoisted(() => vi.fn());

vi.mock("@repo/internationalization/src/routing", async () => {
  const { defaultLocale, locales } = await import("@repo/utilities/locales");
  return { routing: { defaultLocale, locales } };
});

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRoute: routeMocks.read,
  listRuntimeLatestContentRoutes: routeMocks.listLatest,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mockGetTranslations,
}));

vi.mock("next/cache", () => ({
  cacheLife: cacheMocks.life,
  cacheTag: cacheMocks.tag,
}));

const routeRows = [
  {
    locale: "en",
    route: "articles/politics/dynastic-politics-asian-values",
    section: "articles",
  },
  {
    locale: "id",
    route: "articles/politics/dynastic-politics-asian-values",
    section: "articles",
  },
  {
    locale: "en",
    route: "material/lesson/chemistry/green-chemistry/definition",
    section: "material",
  },
];

const translatedDefaults = {
  authors: [{ name: "Nakafa" }],
  date: "",
  description: "Short description",
  title: "Made with love",
};

beforeEach(() => {
  routeMocks.listLatest.mockReset();
  routeMocks.read.mockReset();
  cacheMocks.life.mockClear();
  cacheMocks.tag.mockClear();
  mockGetTranslations.mockReset();

  routeMocks.listLatest.mockImplementation(
    ({ locale, section }: { locale: Locale; section: string }) =>
      Effect.succeed(
        routeRows.filter(
          (route) => route.locale === locale && route.section === section
        )
      )
  );
  routeMocks.read.mockReturnValue(
    Effect.succeed({
      authors: [{ name: "Nakafa" }],
      date: new Date("2025-01-02").getTime(),
      description: "Runtime description",
      title: "Runtime title",
    })
  );
  mockGetTranslations.mockImplementation(({ namespace }) => {
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
  it("builds shallow and deep params from bounded route reads", async () => {
    await expect(
      getStaticParams({ basePath: "articles", paramNames: ["category"] })
    ).resolves.toEqual([{ category: "politics" }]);
    await expect(
      getStaticParams({
        basePath: "material",
        isDeep: true,
        paramNames: ["category", "grade", "material", "slug"],
        slugParam: "slug",
      })
    ).resolves.toEqual([
      {
        category: "lesson",
        grade: "chemistry",
        material: "green-chemistry",
        slug: ["definition"],
      },
    ]);

    expect(routeMocks.listLatest).toHaveBeenCalledWith({
      limit: 100,
      locale: "id",
      section: "articles",
    });
  });

  it("reads only the requested parent locale", async () => {
    await expect(
      getStaticParams({
        basePath: "articles",
        locale: "id",
        paramNames: ["category", "slug"],
      })
    ).resolves.toEqual([
      {
        category: "politics",
        slug: "dynastic-politics-asian-values",
      },
    ]);

    expect(routeMocks.listLatest).toHaveBeenCalledTimes(1);
    expect(routeMocks.listLatest).toHaveBeenCalledWith({
      limit: 100,
      locale: "id",
      section: "articles",
    });
  });

  it("ignores routes that cannot fill the requested params", async () => {
    routeMocks.listLatest
      .mockReturnValueOnce(
        Effect.succeed([
          { route: "articles" },
          { route: "curriculum/merdeka/class-10/chemistry" },
          { route: "articles/politics" },
          { route: "articles/politics/example" },
        ])
      )
      .mockReturnValueOnce(Effect.succeed([]));

    await expect(
      getStaticParams({
        basePath: "articles",
        isDeep: true,
        paramNames: ["category", "slug"],
        slugParam: "slug",
      })
    ).resolves.toEqual([{ category: "politics", slug: ["example"] }]);
  });
});

describe("route catalog metadata", () => {
  it("reads complete metadata from the runtime catalog", async () => {
    await expect(
      Effect.runPromise(
        getMetadataFromSlug("en", ["articles", "politics", "example"])
      )
    ).resolves.toEqual({
      authors: [{ name: "Nakafa" }],
      date: "2025-01-02T00:00:00.000Z",
      description: "Runtime description",
      title: "Runtime title",
    });
  });

  it("uses translated defaults when the catalog has no row", async () => {
    routeMocks.read.mockReturnValueOnce(Effect.succeed(null));
    await expect(
      Effect.runPromise(getMetadataFromSlug("id", ["articles", "missing"]))
    ).resolves.toEqual(translatedDefaults);
  });

  it("preserves typed route-catalog read failures", async () => {
    routeMocks.read.mockReturnValueOnce(
      Effect.fail(
        new NakafaAgentDataReadError({
          cause: "Route catalog unavailable.",
          message: "Unable to read route catalog.",
        })
      )
    );

    const error = await Effect.runPromise(
      Effect.flip(getMetadataFromSlug("id", ["articles", "failed"]))
    );

    expect(error).toBeInstanceOf(NakafaAgentDataReadError);
  });

  it("fills sparse runtime metadata from translations", async () => {
    routeMocks.read.mockReturnValueOnce(
      Effect.succeed({
        authors: [{ name: "Nakafa" }],
        date: undefined,
        description: undefined,
        title: "",
      })
    );

    await expect(
      Effect.runPromise(getMetadataFromSlug("en", ["articles", "sparse"]))
    ).resolves.toEqual(translatedDefaults);
  });

  it("reports which translation namespace failed", async () => {
    mockGetTranslations.mockRejectedValueOnce(new Error("Missing Common."));
    await expect(
      Effect.runPromise(getMetadataFromSlug("en", ["articles", "example"]))
    ).rejects.toThrow('"namespace": "Common"');

    mockGetTranslations.mockImplementation(({ namespace }) => {
      if (namespace === "Common") {
        return Promise.resolve(() => "Made with love");
      }
      return Promise.reject(new Error("Missing Metadata."));
    });
    await expect(
      Effect.runPromise(getMetadataFromSlug("en", ["articles", "example"]))
    ).rejects.toThrow('"namespace": "Metadata"');
  });

  it("applies the content cache at the route-handler boundary", async () => {
    await expect(
      getCachedMetadataFromSlug("en", ["articles", "politics", "example"])
    ).resolves.toMatchObject({ title: "Runtime title" });
    expect(cacheMocks.tag).toHaveBeenCalledWith("content-runtime");
    expect(cacheMocks.life).toHaveBeenCalledWith("contentRuntime");
  });
});

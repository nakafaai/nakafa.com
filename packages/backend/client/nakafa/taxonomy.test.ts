import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { readNakafaTaxonomy } from "@repo/backend/client/nakafa/taxonomy";
import { api } from "@repo/backend/convex/_generated/api";
import {
  encodeTestQuranRow,
  makeQuranSurah,
} from "@repo/backend/test/quran-rows";
import { type FunctionReference, getFunctionName } from "convex/server";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  runtimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", () => ({
  readConvexRuntimeQuery: (url: string, query: unknown, args: unknown) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: () => runtimeMocks.runtimeQuery(url, query, args),
    }),
}));

const quranSnapshotId = Sha256HashSchema.make(`sha256:${"b".repeat(64)}`);

beforeEach(() => {
  runtimeMocks.runtimeQuery.mockReset();
  runtimeMocks.runtimeQuery.mockImplementation(readRuntimeFixture);
});

describe("readNakafaTaxonomy", () => {
  it("assembles taxonomy from signed publications", async () => {
    const taxonomy = await Effect.runPromise(
      readNakafaTaxonomy("https://example.convex.cloud", "id")
    );
    const defaultTaxonomy = await Effect.runPromise(
      readNakafaTaxonomy("https://example.convex.cloud")
    );

    expect(taxonomy.locale).toBe("id");
    expect(defaultTaxonomy.locale).toBe("en");
    expect(taxonomy.quran.surah_count).toBe(114);
    expect(taxonomy.content_counts).toEqual([
      { count: 121, locale: "en" },
      { count: 121, locale: "id" },
    ]);
    expect(taxonomy.tools).toContain("nakafa_get_quran_reference");
    expect(taxonomy.articles.categories).toEqual(["politics"]);
    expect(taxonomy.tryout).toEqual({
      countries: [{ id: "indonesia", label: "Indonesia" }],
      exams: [{ id: "snbt", label: "SNBT" }],
    });
    expect(calledRuntimeQueries()).toContain(
      getFunctionName(api.contentRelease.article.categories)
    );
    expect(calledRuntimeQueries()).toContain(
      getFunctionName(api.contentRelease.article.sitemapBuckets)
    );
    expect(calledRuntimeQueries()).toContain(
      getFunctionName(api.contentRelease.material.sitemapBuckets)
    );
    expect(calledRuntimeQueries()).toContain(
      getFunctionName(api.contentRelease.tryout.taxonomy)
    );
  });

  it("fails closed when an article or material family is unmanaged", async () => {
    for (const family of ["article", "material"]) {
      const target =
        family === "article"
          ? api.contentRelease.article.sitemapBuckets
          : api.contentRelease.material.sitemapBuckets;
      runtimeMocks.runtimeQuery.mockImplementation((convexUrl, query, args) => {
        if (getFunctionName(query) === getFunctionName(target)) {
          return Promise.resolve({ managed: false });
        }

        return readRuntimeFixture(convexUrl, query, args);
      });

      await expect(
        Effect.runPromise(
          Effect.either(
            readNakafaTaxonomy("https://example.convex.cloud", "id")
          )
        )
      ).resolves.toMatchObject({
        _tag: "Left",
        left: {
          _tag: "NakafaAgentDataReadError",
          message: "Unable to read signed Nakafa content inventory.",
        },
      });
    }
  });

  it("pins every article category page to one signed release", async () => {
    runtimeMocks.runtimeQuery.mockImplementation((convexUrl, query, args) => {
      if (
        getFunctionName(query) !==
        getFunctionName(api.contentRelease.article.categories)
      ) {
        return readRuntimeFixture(convexUrl, query, args);
      }
      const categoryArgs = args as {
        expectedManifestHash: string | null;
        expectedReleaseId: string | null;
        paginationOpts: { cursor: string | null };
      };
      if (categoryArgs.paginationOpts.cursor === null) {
        expect(categoryArgs.expectedManifestHash).toBeNull();
        expect(categoryArgs.expectedReleaseId).toBeNull();
        return Promise.resolve(categoryPage(["politics"], false, "next"));
      }

      expect(categoryArgs).toMatchObject({
        expectedManifestHash: `sha256:${"a".repeat(64)}`,
        expectedReleaseId: "article-release",
        paginationOpts: { cursor: "next" },
      });
      return Promise.resolve(categoryPage(["science"], true, ""));
    });

    const taxonomy = await Effect.runPromise(
      readNakafaTaxonomy("https://example.convex.cloud", "id")
    );

    expect(taxonomy.articles.categories).toEqual(["politics", "science"]);
  });

  it("fails closed when signed article taxonomy is stale", async () => {
    runtimeMocks.runtimeQuery.mockImplementation((convexUrl, query, args) => {
      if (
        getFunctionName(query) ===
        getFunctionName(api.contentRelease.article.categories)
      ) {
        return Promise.resolve({
          ...categoryPage(["politics"], true, ""),
          stale: true,
        });
      }
      return readRuntimeFixture(convexUrl, query, args);
    });

    await expect(
      Effect.runPromise(
        Effect.either(readNakafaTaxonomy("https://example.convex.cloud", "id"))
      )
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "NakafaAgentDataReadError" },
    });
  });

  it("fails closed when an article category page loses its cursor", async () => {
    runtimeMocks.runtimeQuery.mockImplementation((convexUrl, query, args) => {
      if (
        getFunctionName(query) ===
        getFunctionName(api.contentRelease.article.categories)
      ) {
        return Promise.resolve(categoryPage(["politics"], false, ""));
      }
      return readRuntimeFixture(convexUrl, query, args);
    });

    await expect(
      Effect.runPromise(
        Effect.either(readNakafaTaxonomy("https://example.convex.cloud", "id"))
      )
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "NakafaAgentDataReadError",
        cause: "Signed article taxonomy for id lost its continuation cursor.",
      },
    });
  });
});

/** Builds one authenticated article category page fixture. */
function categoryPage(
  categories: readonly string[],
  isDone: boolean,
  continueCursor: string
) {
  return {
    activeManifestHash: `sha256:${"a".repeat(64)}`,
    activeReleaseId: "article-release",
    managed: true,
    result: {
      continueCursor,
      isDone,
      page: categories.map((category) => ({
        category,
        rendererDomain: category,
        title: category,
      })),
    },
    sourceRevision: "c".repeat(40),
    stale: false,
  };
}

/** Routes generated Convex query refs to taxonomy reader fixtures. */
function readRuntimeFixture(
  _convexUrl: string,
  query: FunctionReference<"query">,
  _args: unknown
) {
  if (
    getFunctionName(query) === getFunctionName(api.contentRelease.quran.surahs)
  ) {
    return Promise.resolve({
      activeManifestHash: `sha256:${"a".repeat(64)}`,
      activeReleaseId: "quran-release",
      managed: true,
      rowJson: Array.from({ length: 114 }, (_, index) =>
        encodeTestQuranRow(quranSnapshotId, makeQuranSurah(index + 1))
      ),
      snapshotId: quranSnapshotId,
      sourceRevision: "c".repeat(40),
    });
  }

  if (
    getFunctionName(query) ===
    getFunctionName(api.contentRelease.article.categories)
  ) {
    return Promise.resolve(categoryPage(["politics"], true, ""));
  }

  if (
    getFunctionName(query) ===
    getFunctionName(api.contentRelease.article.sitemapBuckets)
  ) {
    return Promise.resolve({
      articleCount: 1,
      buckets: ["0"],
      managed: true,
    });
  }

  if (
    getFunctionName(query) ===
    getFunctionName(api.contentRelease.material.sitemapBuckets)
  ) {
    return Promise.resolve({
      activeReleaseId: "release-id",
      buckets: ["0"],
      managed: true,
      materialCount: 2,
    });
  }

  if (
    getFunctionName(query) ===
    getFunctionName(api.contentRelease.tryout.taxonomy)
  ) {
    return Promise.resolve({
      countries: [{ id: "indonesia", label: "Indonesia" }],
      exams: [{ id: "snbt", label: "SNBT" }],
      routeCount: 4,
    });
  }

  return Promise.reject(new Error("Unhandled taxonomy query fixture."));
}

/** Returns generated Convex query names called by the taxonomy reader. */
function calledRuntimeQueries() {
  return runtimeMocks.runtimeQuery.mock.calls.map(([, query]) =>
    getFunctionName(query)
  );
}

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
  fetchConvexRuntimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", () => ({
  fetchConvexRuntimeQuery: runtimeMocks.fetchConvexRuntimeQuery,
}));

const quranSnapshotId = Sha256HashSchema.make(`sha256:${"b".repeat(64)}`);

beforeEach(() => {
  runtimeMocks.fetchConvexRuntimeQuery.mockReset();
  runtimeMocks.fetchConvexRuntimeQuery.mockImplementation(readRuntimeFixture);
});

describe("readNakafaTaxonomy", () => {
  it("assembles taxonomy from constants and signed publication counts", async () => {
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
    expect(taxonomy.subject.materials).toContain("mathematics");
    expect(taxonomy.tryout).toEqual({
      countries: [{ id: "indonesia", label: "Indonesia" }],
      exams: [{ id: "snbt", label: "SNBT" }],
    });
    expect(calledRuntimeQueries()).toContain(
      getFunctionName(api.contentRelease.article.sitemapBuckets)
    );
    expect(calledRuntimeQueries()).toContain(
      getFunctionName(api.contentRelease.material.sitemapBuckets)
    );
    expect(calledRuntimeQueries()).toContain(
      getFunctionName(api.contentRelease.tryout.taxonomy)
    );
    expect(calledRuntimeQueries()).not.toContain(
      getFunctionName(api.contents.queries.runtime.listContentRouteCounts)
    );
    expect(calledRuntimeQueries()).not.toContain(
      getFunctionName(api.contents.queries.runtime.listContentRoutesByPrefix)
    );
  });

  it("fails closed when an article or material family is unmanaged", async () => {
    for (const family of ["article", "material"]) {
      const target =
        family === "article"
          ? api.contentRelease.article.sitemapBuckets
          : api.contentRelease.material.sitemapBuckets;
      runtimeMocks.fetchConvexRuntimeQuery.mockImplementation(
        (convexUrl, query, args) => {
          if (getFunctionName(query) === getFunctionName(target)) {
            return Promise.resolve({ managed: false });
          }

          return readRuntimeFixture(convexUrl, query, args);
        }
      );

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
});

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
      sourceClaimCount: 0,
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
  return runtimeMocks.fetchConvexRuntimeQuery.mock.calls.map(([, query]) =>
    getFunctionName(query)
  );
}

import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { readNakafaTaxonomy } from "@repo/backend/client/nakafa/taxonomy";
import { api } from "@repo/backend/convex/_generated/api";
import {
  encodeTestQuranRow,
  makeQuranSurah,
} from "@repo/backend/test/quran-rows";
import { toRuntimeQueryError } from "@repo/backend/test/runtime-query";
import { beforeEach, describe, expect, it } from "@repo/testing/effect";
import { type FunctionReference, getFunctionName } from "convex/server";
import { Effect } from "effect";
import { vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  runtimeQuery: vi.fn(),
}));
vi.mock("@repo/backend/client/runtime", () => ({
  readConvexRuntimeQuery: (url: string, query: unknown, args: unknown) =>
    Effect.tryPromise({
      catch: toRuntimeQueryError,
      try: () => runtimeMocks.runtimeQuery(url, query, args),
    }),
}));
const quranSnapshotId = Sha256HashSchema.make(`sha256:${"b".repeat(64)}`);
const APP_LOCALE_PATTERN = new RegExp(
  `^(?:${ACTIVE_APP_LOCALE_CODES.join("|")})$`,
  "u"
);
const ACTIVE_RELEASE = {
  manifestHash: `sha256:${"c".repeat(64)}`,
  releaseId: "release-current",
  sequence: 25,
};
beforeEach(() => {
  runtimeMocks.runtimeQuery.mockReset();
  runtimeMocks.runtimeQuery.mockImplementation(readRuntimeFixture);
});
describe("readNakafaTaxonomy", () => {
  it.live("assembles taxonomy from signed publications", () =>
    Effect.gen(function* () {
      const taxonomy = yield* readNakafaTaxonomy(
        "https://example.convex.cloud",
        "id"
      );
      const defaultTaxonomy = yield* readNakafaTaxonomy(
        "https://example.convex.cloud"
      );
      expect(taxonomy.locale).toBe("id");
      expect(defaultTaxonomy.locale).toBe("en");
      expect(taxonomy.quran.surah_count).toBe(114);
      expect(taxonomy.content_counts).toEqual([
        { count: 121, locale: "en" },
        { count: 121, locale: "id" },
        { count: 121, locale: "de" },
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
      expect(
        calledRuntimeQueries().filter(
          (name) =>
            name === getFunctionName(api.contentRelease.runtime.active.read)
        )
      ).toHaveLength(4);
    })
  );
  it.live("fails closed when an article or material family is unmanaged", () =>
    Effect.gen(function* () {
      for (const family of ["article", "material"]) {
        const target =
          family === "article"
            ? api.contentRelease.article.sitemapBuckets
            : api.contentRelease.material.sitemapBuckets;
        runtimeMocks.runtimeQuery.mockImplementation(
          (convexUrl, query, args) => {
            if (getFunctionName(query) === getFunctionName(target)) {
              return Promise.resolve({ managed: false });
            }
            return readRuntimeFixture(convexUrl, query, args);
          }
        );
        expect(
          yield* Effect.result(
            readNakafaTaxonomy("https://example.convex.cloud", "id")
          )
        ).toMatchObject({
          _tag: "Failure",
          failure: {
            _tag: "NakafaAgentDataReadError",
            message: "Unable to read signed Nakafa content inventory.",
          },
        });
      }
    })
  );
  it.live("pins every article category page to one signed release", () =>
    Effect.gen(function* () {
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
          paginationOpts: {
            cursor: string | null;
          };
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
      const taxonomy = yield* readNakafaTaxonomy(
        "https://example.convex.cloud",
        "id"
      );
      expect(taxonomy.articles.categories).toEqual(["politics", "science"]);
    })
  );
  it.live("fails closed when signed article taxonomy is stale", () =>
    Effect.gen(function* () {
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
      expect(
        yield* Effect.result(
          readNakafaTaxonomy("https://example.convex.cloud", "id")
        )
      ).toMatchObject({
        _tag: "Failure",
        failure: { _tag: "NakafaAgentDataReadError" },
      });
    })
  );
  it.live("fails closed when an article category page loses its cursor", () =>
    Effect.gen(function* () {
      runtimeMocks.runtimeQuery.mockImplementation((convexUrl, query, args) => {
        if (
          getFunctionName(query) ===
          getFunctionName(api.contentRelease.article.categories)
        ) {
          return Promise.resolve(categoryPage(["politics"], false, ""));
        }
        return readRuntimeFixture(convexUrl, query, args);
      });
      expect(
        yield* Effect.result(
          readNakafaTaxonomy("https://example.convex.cloud", "id")
        )
      ).toMatchObject({
        _tag: "Failure",
        failure: {
          _tag: "NakafaAgentDataReadError",
          cause: "Signed article taxonomy for id lost its continuation cursor.",
        },
      });
    })
  );
  it.live(
    "fails closed when the active publication changes during assembly",
    () =>
      Effect.gen(function* () {
        let activeReadCount = 0;
        runtimeMocks.runtimeQuery.mockImplementation(
          (convexUrl, query, args) => {
            if (
              getFunctionName(query) ===
              getFunctionName(api.contentRelease.runtime.active.read)
            ) {
              activeReadCount += 1;
              return Promise.resolve(
                activeReadCount === 1
                  ? ACTIVE_RELEASE
                  : { ...ACTIVE_RELEASE, sequence: 26 }
              );
            }
            return readRuntimeFixture(convexUrl, query, args);
          }
        );
        expect(
          yield* Effect.result(
            readNakafaTaxonomy("https://example.convex.cloud", "id")
          )
        ).toMatchObject({
          _tag: "Failure",
          failure: {
            _tag: "NakafaAgentDataReadError",
            message:
              "Unable to complete one release-pinned Nakafa content read.",
          },
        });
      })
  );
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
  args: unknown
) {
  if (
    getFunctionName(query) ===
    getFunctionName(api.contentRelease.runtime.active.read)
  ) {
    return Promise.resolve(ACTIVE_RELEASE);
  }
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
    expectSignedAppLocale(args);
    return Promise.resolve(categoryPage(["politics"], true, ""));
  }
  if (
    getFunctionName(query) ===
    getFunctionName(api.contentRelease.article.sitemapBuckets)
  ) {
    expectSignedAppLocale(args);
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
    expectSignedAppLocale(args);
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
    expectSignedAppLocale(args);
    return Promise.resolve({
      countries: [{ id: "indonesia", label: "Indonesia" }],
      exams: [{ id: "snbt", label: "SNBT" }],
      routeCount: 4,
    });
  }
  return Promise.reject(new Error("Unhandled taxonomy query fixture."));
}
/** Requires signed inventory reads to map product locale at the client seam. */
function expectSignedAppLocale(args: unknown) {
  expect(args).toMatchObject({
    appLocale: expect.stringMatching(APP_LOCALE_PATTERN),
  });
}
/** Returns generated Convex query names called by the taxonomy reader. */
function calledRuntimeQueries() {
  return runtimeMocks.runtimeQuery.mock.calls.map(([, query]) =>
    getFunctionName(query)
  );
}

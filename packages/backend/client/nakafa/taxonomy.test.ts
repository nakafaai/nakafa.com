import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { readNakafaTaxonomy } from "@repo/backend/client/nakafa/taxonomy";
import { api } from "@repo/backend/convex/_generated/api";
import {
  encodeTestQuranRow,
  makeQuranSurah,
} from "@repo/backend/test/quran-rows";
import { type Locale, LocaleSchema } from "@repo/contents/_types/content";
import type { SourceRegistryRoot } from "@repo/contents/_types/graph/schema";
import { type FunctionReference, getFunctionName } from "convex/server";
import { Effect, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  fetchConvexRuntimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", () => ({
  fetchConvexRuntimeQuery: runtimeMocks.fetchConvexRuntimeQuery,
}));

const CountArgsSchema = Schema.Struct({
  locale: LocaleSchema,
});
const TryoutCountryArgsSchema = Schema.Struct({
  locale: LocaleSchema,
  publicPath: Schema.String,
});
const quranSnapshotId = Sha256HashSchema.make(`sha256:${"b".repeat(64)}`);

beforeEach(() => {
  runtimeMocks.fetchConvexRuntimeQuery.mockReset();
  runtimeMocks.fetchConvexRuntimeQuery.mockImplementation(readRuntimeFixture);
});

describe("readNakafaTaxonomy", () => {
  it("assembles taxonomy from content constants and Convex runtime counts", async () => {
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
      { count: 8, locale: "en" },
      { count: 8, locale: "id" },
    ]);
    expect(taxonomy.tools).toContain("nakafa_get_quran_reference");
    expect(taxonomy.subject.materials).toContain("mathematics");
    expect(taxonomy.tryout).toEqual({
      countries: [{ id: "indonesia", label: "Indonesia" }],
      exams: [{ id: "snbt", label: "SNBT" }],
    });
    expect(calledRuntimeQueries()).toContain(
      getFunctionName(api.contents.queries.runtime.listContentRouteCounts)
    );
    expect(calledRuntimeQueries()).toContain(
      getFunctionName(api.tryouts.queries.catalog.getHubPage)
    );
    expect(calledRuntimeQueries()).toContain(
      getFunctionName(api.tryouts.queries.catalog.getCountryPage)
    );
    expect(calledRuntimeQueries()).not.toContain(
      getFunctionName(api.contents.queries.runtime.listContentRoutesByPrefix)
    );
  });
});

/** Routes generated Convex query refs to taxonomy reader fixtures. */
function readRuntimeFixture(
  _convexUrl: string,
  query: FunctionReference<"query">,
  args: unknown
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
    getFunctionName(api.contents.queries.runtime.listContentRouteCounts)
  ) {
    return Promise.resolve(readContentRouteCounts(args));
  }

  if (
    getFunctionName(query) ===
    getFunctionName(api.tryouts.queries.catalog.getHubPage)
  ) {
    return Promise.resolve({
      countries: [
        {
          countryCode: "ID",
          countryKey: "indonesia",
          examCount: 1,
          publicPath: "try-out/indonesia",
          title: "Indonesia",
        },
      ],
      sourceRevision: "test-revision",
    });
  }

  if (
    getFunctionName(query) ===
    getFunctionName(api.tryouts.queries.catalog.getCountryPage)
  ) {
    const input = Schema.decodeUnknownSync(TryoutCountryArgsSchema)(args);
    return Promise.resolve({
      country: {
        countryCode: "ID",
        countryKey: "indonesia",
        publicPath: input.publicPath,
        title: "Indonesia",
      },
      exams: [
        {
          countryKey: "indonesia",
          examKey: "snbt",
          publicPath: `${input.publicPath}/snbt`,
          title: "SNBT",
        },
      ],
      sourceRevision: "test-revision",
    });
  }

  return Promise.reject(new Error("Unhandled taxonomy query fixture."));
}

/** Builds materialized route-count rows for one taxonomy locale. */
function readContentRouteCounts(args: unknown) {
  const input = Schema.decodeUnknownSync(CountArgsSchema)(args);

  return [
    countRow(input.locale, "articles", 1),
    countRow(input.locale, "material", 2),
    countRow(input.locale, "material", 3),
    countRow(input.locale, "quran", 2),
  ];
}

/** Builds one materialized route-count fixture row. */
function countRow(locale: Locale, section: SourceRegistryRoot, count: number) {
  return {
    count,
    locale,
    section,
    syncedAt: 1,
  };
}

/** Returns generated Convex query names called by the taxonomy reader. */
function calledRuntimeQueries() {
  return runtimeMocks.fetchConvexRuntimeQuery.mock.calls.map(([, query]) =>
    getFunctionName(query)
  );
}

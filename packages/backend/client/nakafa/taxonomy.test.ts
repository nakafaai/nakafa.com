import { readNakafaTaxonomy } from "@repo/backend/client/nakafa/taxonomy";
import { api } from "@repo/backend/convex/_generated/api";
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
  locale: Schema.Literal("en", "id"),
});

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
    expect(taxonomy.quran.surah_count).toBe(2);
    expect(taxonomy.content_counts).toEqual([
      { count: 8, locale: "en" },
      { count: 8, locale: "id" },
    ]);
    expect(taxonomy.tools).toContain("nakafa_get_quran_reference");
    expect(taxonomy.subject.materials).toContain("mathematics");
    expect(calledRuntimeQueries()).toContain(
      getFunctionName(api.contents.queries.runtime.listContentRouteCounts)
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
    getFunctionName(query) ===
    getFunctionName(api.contents.queries.runtime.listQuranSurahs)
  ) {
    return Promise.resolve([{ number: 1 }, { number: 2 }]);
  }

  if (
    getFunctionName(query) ===
    getFunctionName(api.contents.queries.runtime.listContentRouteCounts)
  ) {
    return Promise.resolve(readContentRouteCounts(args));
  }

  return Promise.reject(new Error("Unhandled taxonomy query fixture."));
}

/** Builds materialized route-count rows for one taxonomy locale. */
function readContentRouteCounts(args: unknown) {
  const input = Schema.decodeUnknownSync(CountArgsSchema)(args);

  return [
    countRow(input.locale, "articles", 1),
    countRow(input.locale, "subject", 2),
    countRow(input.locale, "exercises", 3),
    countRow(input.locale, "quran", 2),
  ];
}

/** Builds one materialized route-count fixture row. */
function countRow(
  locale: "en" | "id",
  section: "articles" | "subject" | "exercises" | "quran",
  count: number
) {
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

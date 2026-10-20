// @vitest-environment node

import { QueryResult } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { Result } from "effect";
import {
  readPreloaded,
  readPreloadedResult,
  usePreloadedQuery,
  usePreloadedQueryResult,
} from "@/lib/data/preloaded";

/** The live result that the mocked Confect hook returns. */
const live = vi.hoisted(() => ({ next: vi.fn<() => unknown>() }));

vi.mock("@confect/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@confect/react")>()),
  useQuery: () => live.next(),
}));

describe("preloaded value choice", () => {
  it("shows the live value once Confect has one", () => {
    expect(readPreloaded(QueryResult.succeed("live"), "loader")).toStrictEqual(
      Result.succeed("live")
    );
  });

  it("shows the loader's value until the live result arrives", () => {
    expect(
      readPreloaded(QueryResult.load<string, never>(false), "loader")
    ).toStrictEqual(Result.succeed("loader"));
  });

  it("keeps a failed live query as the failure", () => {
    expect(
      readPreloaded(QueryResult.fail<string, string>("offline"), "loader")
    ).toStrictEqual(Result.fail("offline"));
  });
});

describe("preloaded query hook", () => {
  const ref = refs.public.contents.queries.recent.getRecentlyViewed;

  it("returns the loader's value while the live result loads", () => {
    live.next.mockReturnValue(QueryResult.load(false));
    expect(usePreloadedQuery(ref, { locale: "en" }, [])).toStrictEqual([]);
  });

  it("throws a failed live query to the error boundary", () => {
    live.next.mockReturnValue(QueryResult.fail("offline"));
    expect(() => usePreloadedQuery(ref, { locale: "en" }, [])).toThrow();
  });
});

describe("preloaded query result", () => {
  it("shows the loader's value as a success while the live result loads", () => {
    expect(
      readPreloadedResult(QueryResult.load<string, never>(false), "loader")
    ).toStrictEqual(QueryResult.succeed("loader"));
  });

  it("keeps the live result when the loader has no value", () => {
    const live = QueryResult.load<string, never>(false);
    expect(readPreloadedResult(live, undefined)).toBe(live);
  });

  it("keeps the live result once it has one", () => {
    const live = QueryResult.succeed<string, never>("live");
    expect(readPreloadedResult(live, "loader")).toBe(live);
  });

  it("shows the loader's value while the live query is skipped", () => {
    live.next.mockReturnValue(QueryResult.load(true));
    const ref = refs.public.contents.queries.recent.getRecentlyViewed;
    expect(usePreloadedQueryResult(ref, { locale: "en" }, [])).toStrictEqual(
      QueryResult.succeed([])
    );
  });

  it("returns the live result without a loader value", () => {
    const failed = QueryResult.fail("offline");
    live.next.mockReturnValue(failed);
    const ref = refs.public.contents.queries.recent.getRecentlyViewed;
    expect(usePreloadedQueryResult(ref, { locale: "en" }, undefined)).toBe(
      failed
    );
  });
});

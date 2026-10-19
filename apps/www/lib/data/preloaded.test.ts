// @vitest-environment node

import { QueryResult } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { Result } from "effect";
import { readPreloaded, usePreloadedQuery } from "@/lib/data/preloaded";

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

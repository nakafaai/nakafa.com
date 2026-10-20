// @vitest-environment node

import { QueryResult } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  readPreloadedResult,
  usePreloadedQueryResult,
} from "@/lib/data/preloaded";

/** The live result that the mocked Confect hook returns. */
const live = vi.hoisted(() => ({ next: vi.fn<() => unknown>() }));

vi.mock("@confect/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@confect/react")>()),
  useQuery: () => live.next(),
}));

const ref = refs.public.contents.queries.recent.getRecentlyViewed;

describe("preloaded query result", () => {
  it("shows the loader's value as a success while the live result loads", () => {
    expect(
      readPreloadedResult(QueryResult.load<string, never>(false), "loader")
    ).toStrictEqual(QueryResult.succeed("loader"));
  });

  it("keeps the live result when the loader has no value", () => {
    const pending = QueryResult.load<string, never>(false);
    expect(readPreloadedResult(pending, undefined)).toBe(pending);
  });

  it("keeps the live result once it has one", () => {
    const answered = QueryResult.succeed<string, never>("live");
    expect(readPreloadedResult(answered, "loader")).toBe(answered);
  });

  it("keeps a failed live query as the failure, not the loader's value", () => {
    const failed = QueryResult.fail<string, string>("offline");
    expect(readPreloadedResult(failed, "loader")).toBe(failed);
  });

  it("shows the loader's value while the live query is skipped", () => {
    live.next.mockReturnValue(QueryResult.load(true));
    expect(usePreloadedQueryResult(ref, { locale: "en" }, [])).toStrictEqual(
      QueryResult.succeed([])
    );
  });

  it("returns the live result without a loader value", () => {
    const failed = QueryResult.fail("offline");
    live.next.mockReturnValue(failed);
    expect(usePreloadedQueryResult(ref, { locale: "en" }, undefined)).toBe(
      failed
    );
  });
});

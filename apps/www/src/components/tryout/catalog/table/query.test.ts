import { describe, expect, it } from "@effect/vitest";
import { encodeJsonText } from "@repo/utilities/json";
import { Schema } from "effect";
import {
  CATALOG_QUERY_DEFAULTS,
  CatalogQuery,
  catalogLoaderDeps,
} from "@/components/tryout/catalog/table/query";

const decodeQuery = Schema.decodeUnknownSync(CatalogQuery);

describe("catalog URL selection", () => {
  it("restores combined filtering and sorting from a shared URL", () => {
    expect(
      decodeQuery({
        direction: "desc",
        sort: "durationSeconds",
        status: "expired",
      })
    ).toEqual({
      direction: "desc",
      sort: "durationSeconds",
      status: "expired",
    });
  });

  it("uses the authored order, every set and ascending for an absent URL", () => {
    const defaults = { direction: "asc", sort: "order", status: "all" };
    expect(decodeQuery({})).toEqual(defaults);
    expect(CATALOG_QUERY_DEFAULTS).toEqual(defaults);
  });

  it("decodes a malformed or repeated value to its default, and keeps the other values", () => {
    expect(
      decodeQuery({
        direction: "unknown",
        sort: ["title", "order"],
        status: "unknown",
      })
    ).toEqual({ direction: "asc", sort: "order", status: "all" });
    expect(
      decodeQuery({ sort: "publishedScore", status: "not-started" })
    ).toEqual({
      direction: "asc",
      sort: "publishedScore",
      status: "not-started",
    });
  });

  it("reads a value that TanStack parsed from JSON as its default", () => {
    expect(decodeQuery({ direction: 1, sort: null, status: false })).toEqual({
      direction: "asc",
      sort: "order",
      status: "all",
    });
  });
});

describe("catalog loader dependency", () => {
  it("keys the loader by one JSON whatever order the address lists its keys", () => {
    const canonical = catalogLoaderDeps({
      direction: "asc",
      sort: "order",
      status: "all",
    });
    const spelledOut = catalogLoaderDeps({
      status: "all",
      sort: "order",
      direction: "asc",
    });
    expect(encodeJsonText(spelledOut)).toBe(encodeJsonText(canonical));
    expect(canonical).toEqual(CATALOG_QUERY_DEFAULTS);
  });
});

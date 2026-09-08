import { describe, expect, it } from "@effect/vitest";
import { createSerializer } from "nuqs/server";
import {
  catalogQuery,
  readCatalogQuery,
} from "@/components/tryout/catalog/table/query";

describe("catalog URL selection", () => {
  it("restores combined filtering and sorting from a shared URL", () => {
    const selection = readCatalogQuery({
      status: "expired",
      sort: "durationSeconds",
      direction: "desc",
    });
    expect(selection).toEqual({
      status: "expired",
      sort: "durationSeconds",
      direction: "desc",
    });
    const url = createSerializer(catalogQuery)(selection);
    expect(readCatalogQuery(new URLSearchParams(url))).toEqual(selection);
  });

  it("uses authored order for absent or unsupported URL choices", () => {
    const defaults = { status: "all", sort: "order", direction: "asc" };
    expect(readCatalogQuery({})).toEqual(defaults);
    expect(
      readCatalogQuery({
        status: "unknown",
        sort: "unknown",
        direction: "unknown",
      })
    ).toEqual(defaults);
    expect(
      readCatalogQuery({ status: "not-started", sort: "publishedScore" })
    ).toEqual({
      status: "not-started",
      sort: "publishedScore",
      direction: "asc",
    });
  });
});

import { describe, expect, it } from "vitest";
import { readTryoutSetSort } from "@/components/tryout/catalog/table/sort";

describe("readTryoutSetSort", () => {
  it("uses authored order when TanStack has no active sort", () => {
    expect(readTryoutSetSort([])).toEqual({
      direction: "asc",
      field: "order",
    });
  });

  it("maps the sortable catalog columns to the Convex contract", () => {
    expect(readTryoutSetSort([{ desc: false, id: "title" }])).toEqual({
      direction: "asc",
      field: "title",
    });
    expect(
      readTryoutSetSort([{ desc: true, id: "readyQuestionCount" }])
    ).toEqual({ direction: "desc", field: "readyQuestionCount" });
  });

  it("falls back to authored order for unknown columns", () => {
    expect(readTryoutSetSort([{ desc: true, id: "unknown" }])).toEqual({
      direction: "asc",
      field: "order",
    });
  });
});

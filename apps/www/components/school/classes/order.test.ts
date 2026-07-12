import { describe, expect, it } from "vitest";
import { reorderPage } from "@/components/school/classes/order";

const page = [
  { _id: "first", order: 10, title: "First" },
  { _id: "second", order: 20, title: "Second" },
  { _id: "third", order: 30, title: "Third" },
];

describe("reorderPage", () => {
  it("moves a row up and swaps persisted order values", () => {
    expect(reorderPage(page, "second", "up")).toEqual([
      { _id: "second", order: 10, title: "Second" },
      { _id: "first", order: 20, title: "First" },
      page[2],
    ]);
  });

  it("moves a row down and swaps persisted order values", () => {
    expect(reorderPage(page, "second", "down")).toEqual([
      page[0],
      { _id: "third", order: 20, title: "Third" },
      { _id: "second", order: 30, title: "Second" },
    ]);
  });

  it("preserves a page when the row or neighbor is not loaded", () => {
    expect(reorderPage(page, "missing", "up")).toBe(page);
    expect(reorderPage(page, "first", "up")).toBe(page);
    expect(reorderPage(page, "third", "down")).toBe(page);
  });
});

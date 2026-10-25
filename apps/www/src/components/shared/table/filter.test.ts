import { describe, expect, it } from "@effect/vitest";
import { choosesNothing, isChosen } from "@/components/shared/table/filter";

describe("a facet filter over cells that hold one value", () => {
  it("keeps a cell whose value the facet chose and drops one it did not", () => {
    expect(isChosen("teacher", ["owner", "teacher"])).toBe(true);
    expect(isChosen("student", ["owner", "teacher"])).toBe(false);
  });

  it("keeps nothing for a cell or a choice that is not text", () => {
    expect(isChosen(3, ["3"])).toBe(false);
    expect(isChosen("owner", "owner")).toBe(false);
  });

  it("drops a facet that chose nothing and keeps one that chose a value", () => {
    expect(choosesNothing(undefined)).toBe(true);
    expect(choosesNothing([])).toBe(true);
    expect(choosesNothing(["owner"])).toBe(false);
  });
});

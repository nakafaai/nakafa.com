import { describe, expect, it } from "@effect/vitest";
import {
  Building01Icon,
  Building02Icon,
  Building03Icon,
} from "@hugeicons/core-free-icons";
import { Array as Arr } from "effect";
import {
  choosesNothing,
  isChosen,
  namedOptions,
} from "@/components/shared/table/filter";

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

describe("the options of a facet whose values the school names", () => {
  const pool = [Building01Icon, Building02Icon, Building03Icon] as const;

  it("names each value and gives each an icon that no other value of the facet holds", () => {
    const options = namedOptions(
      ["SD Nusantara", "SMP Nusantara", "SMA"],
      pool
    );

    expect(Arr.map(options, ({ label, value }) => [label, value])).toEqual([
      ["SD Nusantara", "SD Nusantara"],
      ["SMP Nusantara", "SMP Nusantara"],
      ["SMA", "SMA"],
    ]);
    expect(Arr.dedupe(Arr.map(options, ({ icon }) => icon))).toHaveLength(3);
  });

  it("repeats an icon only once the facet holds more values than its pool has icons", () => {
    const options = namedOptions(["A", "B", "C", "D"], pool);

    expect(Arr.dedupe(Arr.map(options, ({ icon }) => icon))).toHaveLength(3);
  });
});

import { describe, expect, it } from "@effect/vitest";
import {
  Building01Icon,
  Building02Icon,
  Building03Icon,
} from "@hugeicons/core-free-icons";
import { Array as Arr, Option, Schema } from "effect";
import {
  boundOf,
  choosesNothing,
  chosenOne,
  columnFiltersOf,
  holdsChosen,
  holdsText,
  inRange,
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

describe("a facet filter over cells that hold a list", () => {
  it("keeps a list that holds one of the chosen values and drops one that holds none", () => {
    expect(holdsChosen(["teacher", "proctor"], ["proctor"])).toBe(true);
    expect(holdsChosen(["student"], ["owner", "teacher"])).toBe(false);
    expect(holdsChosen([], ["owner"])).toBe(false);
  });

  it("keeps nothing for a cell or a choice that is not a list of text", () => {
    expect(holdsChosen("owner", ["owner"])).toBe(false);
    expect(holdsChosen(["owner"], "owner")).toBe(false);
  });
});

describe("a text column's filter", () => {
  it("keeps a cell that holds every chosen text, whatever the case", () => {
    expect(holdsText("Nabil Akbar", ["nabil"])).toBe(true);
    expect(holdsText("Nabil Akbar", ["nabil", "AKBAR"])).toBe(true);
    expect(holdsText("Nabil Akbar", ["nabil", "fatih"])).toBe(false);
  });

  it("keeps nothing for a cell or a choice that is not text", () => {
    expect(holdsText(3, ["3"])).toBe(false);
    expect(holdsText("3", "3")).toBe(false);
  });
});

describe("a number column's filter", () => {
  it("keeps a number on or between the chosen bounds", () => {
    expect(inRange(10, ["10", "20"])).toBe(true);
    expect(inRange(20, ["10", "20"])).toBe(true);
    expect(inRange(9, ["10", "20"])).toBe(false);
    expect(inRange(21, ["10", "20"])).toBe(false);
  });

  it("holds no bound on a blank side", () => {
    expect(inRange(1000, ["10", ""])).toBe(true);
    expect(inRange(-5, ["", "20"])).toBe(true);
    expect(inRange(0, ["10", ""])).toBe(false);
  });

  it("keeps nothing for a cell without a number, or a choice that is no range", () => {
    expect(inRange(null, ["10", "20"])).toBe(false);
    expect(inRange(10, ["10"])).toBe(false);
  });

  it("reads a field as a number only while it holds one", () => {
    expect(boundOf("12.5")).toEqual(Option.some(12.5));
    expect(boundOf("")).toEqual(Option.none());
    expect(boundOf(" ")).toEqual(Option.none());
    expect(boundOf("x")).toEqual(Option.none());
  });
});

describe("the filters a table reads", () => {
  it("drops a column that chose nothing", () => {
    expect(
      columnFiltersOf({ name: [], status: ["open"] }, undefined, "")
    ).toEqual([{ id: "status", value: ["open"] }]);
  });

  it("joins the page's search to what its column chose", () => {
    expect(columnFiltersOf({ name: ["nab"] }, "name", "akb")).toEqual([
      { id: "name", value: ["nab", "akb"] },
    ]);
    expect(columnFiltersOf({}, "name", "akb")).toEqual([
      { id: "name", value: ["akb"] },
    ]);
  });

  it("leaves the search out when the page searches no column or holds no text", () => {
    expect(columnFiltersOf({}, undefined, "akb")).toEqual([]);
    expect(columnFiltersOf({}, "name", "")).toEqual([]);
  });
});

describe("the one value a column's choice keeps", () => {
  const isState = Schema.is(Schema.Literals(["open", "closed"]));

  it("reads the first value chosen for the column", () => {
    expect(chosenOne({ state: ["closed"] }, "state", isState)).toEqual(
      Option.some("closed")
    );
  });

  it("keeps every row while the column chose nothing, or a value it does not know", () => {
    expect(chosenOne({}, "state", isState)).toEqual(Option.none());
    expect(chosenOne({ state: [] }, "state", isState)).toEqual(Option.none());
    expect(chosenOne({ state: ["gone"] }, "state", isState)).toEqual(
      Option.none()
    );
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

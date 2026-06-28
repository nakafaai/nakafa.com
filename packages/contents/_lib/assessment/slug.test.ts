import {
  compareExerciseSetSlugs,
  getExerciseNumberPagination,
  getExerciseSetTarget,
  getExercisesPagination,
  getSlugPath,
  hasInvalidTryOutYearSlug,
  isExerciseNumberSegment,
  isTryOutCollectionSlug,
} from "@repo/contents/_lib/assessment/slug";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

describe("exercise slug helpers", () => {
  it("sorts exercise set slugs by numeric suffix", () => {
    expect(["set-1", "set-10", "set-2"].sort(compareExerciseSetSlugs)).toEqual([
      "set-1",
      "set-2",
      "set-10",
    ]);
    expect(
      [
        "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-1",
        "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-10",
        "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-2",
      ].sort(compareExerciseSetSlugs)
    ).toEqual([
      "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-1",
      "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-2",
      "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-10",
    ]);
  });

  it("builds canonical exercise paths and classifies try-out collection slugs", () => {
    expect(
      getSlugPath("high-school", "snbt", "general-reasoning", [
        "try-out",
        "2026",
        "set-1",
      ])
    ).toBe(
      "/material/practice/assessment/snbt/general-reasoning/try-out-2026/set-1"
    );
    expect(
      getSlugPath("high-school", "snbt", "general-reasoning", [
        "practice",
        "set-1",
      ])
    ).toBe(
      "/material/practice/assessment/snbt/general-reasoning/practice/set-1"
    );
    expect(isTryOutCollectionSlug(["try-out"])).toBe(false);
    expect(isTryOutCollectionSlug(["try-out", "2026"])).toBe(true);
    expect(isTryOutCollectionSlug(["try-out", "set-1"])).toBe(false);
    expect(hasInvalidTryOutYearSlug(["try-out"])).toBe(true);
    expect(hasInvalidTryOutYearSlug(["try-out", "set-1"])).toBe(true);
    expect(hasInvalidTryOutYearSlug(["try-out", "2026"])).toBe(false);
    expect(hasInvalidTryOutYearSlug(["semester-1", "set-1"])).toBe(false);
  });

  it.each([
    ["10", true],
    [" 10 ", true],
    ["0", false],
    ["01", false],
    ["10a", false],
    ["", false],
  ] as const)("checks exercise number segment %s", (value, expected) => {
    expect(isExerciseNumberSegment(value)).toBe(expected);
  });

  it("splits exercise set paths from optional exercise numbers", () => {
    const setTarget = getExerciseSetTarget(
      "/material/practice/assessment/snbt/general-reasoning/try-out-2026/set-10"
    );
    const numberTarget = getExerciseSetTarget(
      "/material/practice/assessment/snbt/general-reasoning/try-out-2026/set-10/question-1"
    );

    expect(setTarget.filePath).toBe(
      "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-10"
    );
    expect(Option.isNone(setTarget.exerciseNumber)).toBe(true);
    expect(numberTarget.filePath).toBe(
      "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-10"
    );
    expect(Option.getOrUndefined(numberTarget.exerciseNumber)).toBe(1);

    const numericTarget = getExerciseSetTarget(
      "/material/practice/assessment/snbt/general-reasoning/try-out-2026/set-10/2"
    );

    expect(numericTarget.filePath).toBe(
      "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-10"
    );
    expect(Option.getOrUndefined(numericTarget.exerciseNumber)).toBe(2);
  });

  it("builds collection pagination links", () => {
    const materials = [
      {
        href: "/material",
        title: "Material",
        items: [
          { href: "/one", title: "One" },
          { href: "/two", title: "Two" },
          { href: "/three", title: "Three" },
        ],
      },
    ];

    expect(getExercisesPagination("/missing", materials)).toStrictEqual({
      next: { href: "", title: "" },
      prev: { href: "", title: "" },
    });
    expect(getExercisesPagination("/one", materials)).toStrictEqual({
      next: { href: "/two", title: "Two" },
      prev: { href: "", title: "" },
    });
    expect(getExercisesPagination("/two", materials)).toStrictEqual({
      next: { href: "/three", title: "Three" },
      prev: { href: "/one", title: "One" },
    });
    expect(getExercisesPagination("/three", materials)).toStrictEqual({
      next: { href: "", title: "" },
      prev: { href: "/two", title: "Two" },
    });
  });

  it("builds numbered exercise pagination links", () => {
    const titleFormatter = (number: number) => `Exercise ${number}`;

    expect(
      getExerciseNumberPagination("/set", 1, 3, titleFormatter)
    ).toStrictEqual({
      next: { href: "/set/2", title: "Exercise 2" },
      prev: { href: "", title: "" },
    });
    expect(
      getExerciseNumberPagination("/set", 2, 3, titleFormatter)
    ).toStrictEqual({
      next: { href: "/set/3", title: "Exercise 3" },
      prev: { href: "/set/1", title: "Exercise 1" },
    });
    expect(
      getExerciseNumberPagination("/set", 3, 3, titleFormatter)
    ).toStrictEqual({
      next: { href: "", title: "" },
      prev: { href: "/set/2", title: "Exercise 2" },
    });
  });
});

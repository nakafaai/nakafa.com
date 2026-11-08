import { describe, expect, it } from "@effect/vitest";
import { gradesOf, lastGradeOf } from "@repo/backend/confect/tenancy/grades";
import { Option } from "effect";

describe("tenancy/grades", () => {
  it("offers each level its national grades, and a level without a range every grade a cohort may hold", () => {
    expect(gradesOf("sd")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(gradesOf("mts")).toEqual([7, 8, 9]);
    expect(gradesOf("smk")).toEqual([10, 11, 12]);
    expect(gradesOf("paud")).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
  });

  it("graduates a level at the last grade of its range, and a level without a range at none", () => {
    expect(lastGradeOf("mi")).toStrictEqual(Option.some(6));
    expect(lastGradeOf("smp")).toStrictEqual(Option.some(9));
    expect(lastGradeOf("ma")).toStrictEqual(Option.some(12));
    expect(lastGradeOf("slb")).toStrictEqual(Option.none());
  });
});

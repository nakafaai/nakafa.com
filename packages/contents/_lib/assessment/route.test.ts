import {
  getCategoryPath,
  getExercisesPath,
  getMaterialPath,
  parseExercisesCategory,
  parseExercisesMaterial,
  parseExercisesType,
} from "@repo/contents/_lib/assessment/route";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

describe("exercises route helpers", () => {
  it("builds category and type routes", () => {
    expect(getCategoryPath("high-school")).toBe("/assessment/high-school");
    expect(getExercisesPath("high-school", "snbt")).toBe(
      "/assessment/high-school/snbt"
    );
  });

  it("builds material routes", () => {
    expect(
      getMaterialPath("high-school", "snbt", "quantitative-knowledge")
    ).toBe("/assessment/high-school/snbt/quantitative-knowledge");
  });

  it("parses valid route segments and rejects invalid ones", () => {
    expect(Option.getOrUndefined(parseExercisesCategory("high-school"))).toBe(
      "high-school"
    );
    expect(Option.isNone(parseExercisesCategory("not-a-category"))).toBe(true);
    expect(Option.getOrUndefined(parseExercisesType("grade-9"))).toBe(
      "grade-9"
    );
    expect(Option.isNone(parseExercisesType("not-a-type"))).toBe(true);
    expect(Option.getOrUndefined(parseExercisesMaterial("mathematics"))).toBe(
      "mathematics"
    );
    expect(Option.isNone(parseExercisesMaterial("not-a-material"))).toBe(true);
  });
});

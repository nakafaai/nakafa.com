import {
  getCategoryPath,
  getExercisesPath,
  getMaterialPath,
  parseExercisesCategory,
  parseExercisesMaterial,
  parseExercisesType,
} from "@repo/contents/_lib/exercises/route";
import { describe, expect, it } from "vitest";

describe("exercises route helpers", () => {
  it("builds category and type routes", () => {
    expect(getCategoryPath("high-school")).toBe("/exercises/high-school");
    expect(getExercisesPath("high-school", "snbt")).toBe(
      "/exercises/high-school/snbt"
    );
  });

  it("builds material routes", () => {
    expect(
      getMaterialPath("high-school", "snbt", "quantitative-knowledge")
    ).toBe("/exercises/high-school/snbt/quantitative-knowledge");
  });

  it("parses valid route segments and rejects invalid ones", () => {
    expect(parseExercisesCategory("high-school")).toBe("high-school");
    expect(parseExercisesCategory("not-a-category")).toBeNull();
    expect(parseExercisesType("grade-9")).toBe("grade-9");
    expect(parseExercisesType("not-a-type")).toBeNull();
    expect(parseExercisesMaterial("mathematics")).toBe("mathematics");
    expect(parseExercisesMaterial("not-a-material")).toBeNull();
  });
});

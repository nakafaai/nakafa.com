import {
  getExerciseNumberPaths,
  getExerciseSetPaths,
} from "@repo/contents/_lib/manifest/exercise-paths";
import { describe, expect, it } from "vitest";

describe("getExerciseSetPaths", () => {
  it("extracts unique exercise set paths", () => {
    const result = getExerciseSetPaths([
      "material/practice/assessment/math/set-1/question-1",
      "material/practice/assessment/math/set-1/question-2",
      "material/practice/assessment/math/set-2/question-1",
    ]);

    expect(result).toStrictEqual([
      "material/practice/assessment/math/set-1",
      "material/practice/assessment/math/set-2",
    ]);
  });

  it("ignores non-exercise slugs", () => {
    const result = getExerciseSetPaths([
      "articles/my-article",
      "curriculum/math/algebra",
    ]);

    expect(result).toStrictEqual([]);
  });
});

describe("getExerciseNumberPaths", () => {
  it("extracts unique exercise number paths", () => {
    const result = getExerciseNumberPaths([
      "material/practice/assessment/math/set-1/question-1",
      "material/practice/assessment/math/set-1/question-2",
    ]);

    expect(result).toStrictEqual([
      "material/practice/assessment/math/set-1/question-1",
      "material/practice/assessment/math/set-1/question-2",
    ]);
  });

  it("supports multi-digit exercise numbers", () => {
    const result = getExerciseNumberPaths([
      "material/practice/assessment/math/set-1/question-10",
      "material/practice/assessment/math/set-1/question-99",
    ]);

    expect(result).toStrictEqual([
      "material/practice/assessment/math/set-1/question-10",
      "material/practice/assessment/math/set-1/question-99",
    ]);
  });
});

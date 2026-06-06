import {
  getExerciseNumberPaths,
  getExerciseSetPaths,
} from "@repo/contents/_lib/manifest/exercise-paths";
import { describe, expect, it } from "vitest";

describe("getExerciseSetPaths", () => {
  it("extracts unique exercise set paths", () => {
    const result = getExerciseSetPaths([
      "exercises/math/set-1/1/_question",
      "exercises/math/set-1/1/_answer",
      "exercises/math/set-1/2/_question",
      "exercises/math/set-2/1/_question",
    ]);

    expect(result).toStrictEqual([
      "exercises/math/set-1",
      "exercises/math/set-2",
    ]);
  });

  it("ignores non-exercise slugs", () => {
    const result = getExerciseSetPaths([
      "articles/my-article",
      "subject/math/algebra",
    ]);

    expect(result).toStrictEqual([]);
  });
});

describe("getExerciseNumberPaths", () => {
  it("extracts unique exercise number paths", () => {
    const result = getExerciseNumberPaths([
      "exercises/math/set-1/1/_question",
      "exercises/math/set-1/1/_answer",
      "exercises/math/set-1/2/_question",
    ]);

    expect(result).toStrictEqual([
      "exercises/math/set-1/1",
      "exercises/math/set-1/2",
    ]);
  });

  it("supports multi-digit exercise numbers", () => {
    const result = getExerciseNumberPaths([
      "exercises/math/set-1/10/_question",
      "exercises/math/set-1/99/_question",
    ]);

    expect(result).toStrictEqual([
      "exercises/math/set-1/10",
      "exercises/math/set-1/99",
    ]);
  });
});

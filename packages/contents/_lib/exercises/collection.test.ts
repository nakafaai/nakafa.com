import {
  getExerciseQuestionNumbers,
  getExerciseSetPathsFromSlugs,
} from "@repo/contents/_lib/exercises/collection";
import { describe, expect, it } from "vitest";

const exerciseBasePath =
  "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1";

describe("getExerciseQuestionNumbers", () => {
  it("collects direct exercise numbers from a set path", () => {
    const result = getExerciseQuestionNumbers(
      [
        `${exerciseBasePath}/2/_answer`,
        `${exerciseBasePath}/1/_question`,
        `${exerciseBasePath}/1/_answer`,
        `${exerciseBasePath}/10/_question`,
      ],
      exerciseBasePath
    );

    expect(result).toStrictEqual(["1", "2", "10"]);
  });

  it("skips slugs outside the requested exercise set", () => {
    const result = getExerciseQuestionNumbers(
      [
        `${exerciseBasePath}/1/_question`,
        "exercises/high-school/snbt/general-knowledge/try-out/2026/set-1/9/_answer",
      ],
      exerciseBasePath
    );

    expect(result).toStrictEqual(["1"]);
  });

  it("supports empty base paths when scanning already-trimmed slugs", () => {
    const result = getExerciseQuestionNumbers(
      ["1/_question", "1/_answer", "2/_question"],
      ""
    );

    expect(result).toStrictEqual(["1", "2"]);
  });

  it("ignores yearly collection folders that are not direct exercise numbers", () => {
    const result = getExerciseQuestionNumbers(
      [
        `${exerciseBasePath}/1/_question`,
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/1/_answer",
      ],
      "exercises/high-school/snbt/quantitative-knowledge/try-out"
    );

    expect(result).toStrictEqual([]);
  });

  it("ignores nested entries that are not question or answer folders", () => {
    const result = getExerciseQuestionNumbers(
      [
        `${exerciseBasePath}/1/choices`,
        `${exerciseBasePath}/2/notes`,
        `${exerciseBasePath}/3/_question`,
      ],
      exerciseBasePath
    );

    expect(result).toStrictEqual(["3"]);
  });
});

describe("getExerciseSetPathsFromSlugs", () => {
  it("collects set paths without rereading the MDX cache", () => {
    const result = getExerciseSetPathsFromSlugs([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
      "articles/politics/dynastic-politics-asian-values",
    ]);

    expect(result).toStrictEqual([exerciseBasePath]);
  });
});

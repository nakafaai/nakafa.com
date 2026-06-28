import {
  getExerciseQuestionNumber,
  getExerciseQuestionNumbers,
  getExerciseSetPathsFromSlugs,
} from "@repo/contents/_lib/assessment/collection";
import { describe, expect, it } from "vitest";

const exerciseBasePath =
  "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1";

describe("getExerciseQuestionNumbers", () => {
  it("returns null for malformed question folder segments", () => {
    expect(getExerciseQuestionNumber("question-x")).toBeNull();
  });

  it("collects direct exercise numbers from a set path", () => {
    const result = getExerciseQuestionNumbers(
      [
        `${exerciseBasePath}/question-2/answer`,
        `${exerciseBasePath}/question-1/question`,
        `${exerciseBasePath}/question-1/answer`,
        `${exerciseBasePath}/question-10/question`,
      ],
      exerciseBasePath
    );

    expect(result).toStrictEqual(["question-1", "question-2", "question-10"]);
  });

  it("skips slugs outside the requested exercise set", () => {
    const result = getExerciseQuestionNumbers(
      [
        `${exerciseBasePath}/question-1/question`,
        "material/practice/assessment/snbt/general-knowledge/try-out-2026/set-1/question-9/answer",
      ],
      exerciseBasePath
    );

    expect(result).toStrictEqual(["question-1"]);
  });

  it("supports empty base paths when scanning already-trimmed slugs", () => {
    const result = getExerciseQuestionNumbers(
      ["question-1/question", "question-1/answer", "question-2/question"],
      ""
    );

    expect(result).toStrictEqual(["question-1", "question-2"]);
  });

  it("ignores yearly collection folders that are not direct exercise numbers", () => {
    const result = getExerciseQuestionNumbers(
      [
        `${exerciseBasePath}/question-1/question`,
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-2/question-1/answer",
      ],
      "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026"
    );

    expect(result).toStrictEqual([]);
  });

  it("ignores nested entries that are not question or answer folders", () => {
    const result = getExerciseQuestionNumbers(
      [
        `${exerciseBasePath}/question-1/choices`,
        `${exerciseBasePath}/question-2/notes`,
        `${exerciseBasePath}/question-3/question`,
      ],
      exerciseBasePath
    );

    expect(result).toStrictEqual(["question-3"]);
  });
});

describe("getExerciseSetPathsFromSlugs", () => {
  it("collects set paths without rereading the MDX cache", () => {
    const result = getExerciseSetPathsFromSlugs([
      `${exerciseBasePath}/question-1/question`,
      `${exerciseBasePath}/question-1/answer`,
      "articles/politics/dynastic-politics-asian-values",
    ]);

    expect(result).toStrictEqual([exerciseBasePath]);
  });

  it("ignores incomplete and unsupported exercise content slugs", () => {
    const result = getExerciseSetPathsFromSlugs([
      "single",
      `${exerciseBasePath}/question-1`,
      `${exerciseBasePath}/question-2/choices`,
      `${exerciseBasePath}/question-3/answer`,
    ]);

    expect(result).toStrictEqual([exerciseBasePath]);
  });
});

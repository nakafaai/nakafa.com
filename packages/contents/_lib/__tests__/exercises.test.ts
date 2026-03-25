import { getExerciseQuestionNumbers } from "@repo/contents/_lib/exercises";
import { describe, expect, it } from "vitest";

describe("getExerciseQuestionNumbers", () => {
  it("collects direct exercise numbers from a set path", () => {
    const result = getExerciseQuestionNumbers(
      [
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/2/_answer",
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/_question",
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/_answer",
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/10/_question",
      ],
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1"
    );

    expect(result).toStrictEqual(["1", "2", "10"]);
  });

  it("ignores yearly collection folders that are not direct exercise numbers", () => {
    const result = getExerciseQuestionNumbers(
      [
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/_question",
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/1/_answer",
      ],
      "exercises/high-school/snbt/quantitative-knowledge/try-out"
    );

    expect(result).toStrictEqual([]);
  });

  it("ignores nested entries that are not question or answer folders", () => {
    const result = getExerciseQuestionNumbers(
      [
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/choices",
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/2/notes",
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/3/_question",
      ],
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1"
    );

    expect(result).toStrictEqual(["3"]);
  });
});

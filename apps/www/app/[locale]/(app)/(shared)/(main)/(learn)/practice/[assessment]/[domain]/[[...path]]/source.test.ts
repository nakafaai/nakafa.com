// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  localizeQuestionPaginationItem,
  readExerciseSetSourceParts,
  readQuestionSourcePathParts,
} from "./source";

describe("practice route source parsing", () => {
  it("parses source-owned practice set and question paths", () => {
    expect(
      readQuestionSourcePathParts(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9"
      )
    ).toEqual({
      questionNumber: 9,
      setSourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
    });
    expect(
      readExerciseSetSourceParts(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1"
      )
    ).toEqual({
      category: "high-school",
      exerciseType: "try-out",
      material: "quantitative-knowledge",
      type: "snbt",
      year: "2026",
    });
  });

  it("localizes numeric question pagination segments only", () => {
    const emptyHrefItem = { href: "", title: "Question" };

    expect(localizeQuestionPaginationItem(emptyHrefItem)).toBe(emptyHrefItem);
    expect(
      localizeQuestionPaginationItem({
        href: "/en/practice/snbt/quantitative-knowledge/tryout-2026/set-1/question",
        title: "Question",
      })
    ).toEqual({
      href: "/en/practice/snbt/quantitative-knowledge/tryout-2026/set-1/question",
      title: "Question",
    });
    expect(
      localizeQuestionPaginationItem({
        href: "/en/practice/snbt/quantitative-knowledge/tryout-2026/set-1/2",
        title: "Question 2",
      })
    ).toEqual({
      href: "/en/practice/snbt/quantitative-knowledge/tryout-2026/set-1/question-2",
      title: "Question 2",
    });
  });

  it("fails closed for invalid source paths", () => {
    expect(() => readQuestionSourcePathParts("question-x")).toThrow();
    expect(() => readQuestionSourcePathParts("")).toThrow();
    expect(() => readExerciseSetSourceParts("material/practice")).toThrow();
    expect(() =>
      readExerciseSetSourceParts(
        "material/practice/assessment/unknown/quantitative-knowledge/try-out-2026/set-1"
      )
    ).toThrow();
  });
});

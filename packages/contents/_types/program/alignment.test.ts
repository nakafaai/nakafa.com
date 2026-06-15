import { getLearningProgramCoverageAlignmentIssues } from "@repo/contents/_types/program/alignment";
import { LEARNING_PROGRAM_CATALOG } from "@repo/contents/_types/program/catalog";
import { describe, expect, it } from "vitest";

describe("program/alignment", () => {
  it("keeps coverage ownership keys aligned with the catalog", () => {
    expect(getLearningProgramCoverageAlignmentIssues()).toEqual([]);
  });

  it("reports broken alignment keys before coverage sync runs", () => {
    expect(
      getLearningProgramCoverageAlignmentIssues({
        alignments: [
          {
            match: { fallback: true },
            programKey: "missing-program",
          },
        ],
        programs: LEARNING_PROGRAM_CATALOG,
      })
    ).toEqual(["Unknown learning program key: missing-program"]);
  });
});

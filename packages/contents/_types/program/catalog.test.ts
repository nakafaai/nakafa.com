import {
  findLearningProgramByKey,
  getDefaultLearningProgramKey,
  LEARNING_PROGRAM_CATALOG,
  listDiscoverableLearningPrograms,
} from "@repo/contents/_types/program/catalog";
import { describe, expect, it } from "vitest";

describe("program/catalog", () => {
  it("hides unsupported programs from discovery", () => {
    const [program] = LEARNING_PROGRAM_CATALOG;
    const visibleKeys = listDiscoverableLearningPrograms([
      ...LEARNING_PROGRAM_CATALOG,
      { ...program, defaultCoverageStatus: "hidden", key: "hidden-program" },
    ]).map((item) => item.key);

    expect(visibleKeys).not.toContain("hidden-program");
  });

  it("uses catalog defaults for discovery and direct program lookup", () => {
    const visibleKeys = listDiscoverableLearningPrograms().map(
      (program) => program.key
    );

    expect(visibleKeys).toContain(getDefaultLearningProgramKey());
    expect(findLearningProgramByKey("snbt-2026")).toMatchObject({
      kind: "admission-exam",
    });
    expect(findLearningProgramByKey("missing-program")).toBeNull();
  });
});

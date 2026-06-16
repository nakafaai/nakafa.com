import {
  findLearningProgramByKey,
  LEARNING_PROGRAM_CATALOG,
  listDiscoverableLearningPrograms,
} from "@repo/contents/_types/program/catalog";
import { LearningProgramKeySchema } from "@repo/contents/_types/program/schema";
import { describe, expect, it } from "vitest";

describe("program/catalog", () => {
  it("keeps one canonical program key with localized display copy", () => {
    const keys = LEARNING_PROGRAM_CATALOG.map((program) => program.key);

    expect(new Set(keys).size).toBe(keys.length);
    for (const program of LEARNING_PROGRAM_CATALOG) {
      expect(program.translations.en.title.length).toBeGreaterThan(0);
      expect(program.translations.id.title.length).toBeGreaterThan(0);
      expect(program.navigation.levels.length).toBeGreaterThan(0);
      expect(program).not.toHaveProperty("locale");
    }
  });

  it("stores hierarchy models without enumerating content route coverage", () => {
    const schoolProgram = findLearningProgramByKey("id-kurikulum-merdeka");
    const cambridgeProgram = findLearningProgramByKey("cambridge-igcse");
    const examProgram = findLearningProgramByKey("snbt-2026");

    expect(schoolProgram?.navigation).toEqual({
      levels: ["class", "subject", "topic"],
      model: "class-curriculum-topic",
    });
    expect(examProgram?.navigation).toEqual({
      levels: ["section", "domain", "practice-set"],
      model: "exam-domain-practice-set",
    });
    expect(cambridgeProgram?.navigation).toEqual({
      levels: ["course", "unit", "lesson"],
      model: "course-unit-lesson",
    });
    expect(JSON.stringify(LEARNING_PROGRAM_CATALOG)).not.toContain(
      "curriculum/high-school"
    );
  });

  it("hides unsupported programs from discovery", () => {
    const [program] = LEARNING_PROGRAM_CATALOG;
    const visibleKeys = listDiscoverableLearningPrograms([
      ...LEARNING_PROGRAM_CATALOG,
      {
        ...program,
        defaultCoverageStatus: "hidden",
        key: LearningProgramKeySchema.make("hidden-program"),
      },
    ]).map((item) => item.key);

    expect(visibleKeys).not.toContain("hidden-program");
  });

  it("uses direct program lookup without inventing a default curriculum", () => {
    const visibleKeys = listDiscoverableLearningPrograms().map(
      (program) => program.key
    );

    expect(visibleKeys).toEqual([
      "id-kurikulum-merdeka",
      "cambridge-igcse",
      "us-common-core-ngss",
      "tka-2026",
      "snbt-2026",
    ]);
    expect(findLearningProgramByKey("snbt-2026")).toMatchObject({
      kind: "admission-exam",
    });
    expect(findLearningProgramByKey("missing-program")).toBeNull();
  });
});

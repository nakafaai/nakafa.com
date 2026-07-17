import {
  findLearningProgramByKey,
  LEARNING_PROGRAM_CATALOG,
} from "@repo/contents/_types/program/catalog";
import { locales } from "@repo/utilities/locales";
import { describe, expect, it } from "vitest";

describe("program/catalog", () => {
  it("keeps one canonical program key with localized display copy", () => {
    const keys = LEARNING_PROGRAM_CATALOG.map((program) => program.key);

    expect(new Set(keys).size).toBe(keys.length);
    for (const program of LEARNING_PROGRAM_CATALOG) {
      for (const locale of locales) {
        expect(program.translations[locale].title.length).toBeGreaterThan(0);
      }
      expect(program.navigation.levels.length).toBeGreaterThan(0);
      expect(program).not.toHaveProperty("locale");
      for (const translation of Object.values(program.translations)) {
        expect(translation).not.toHaveProperty("description");
      }
    }

    expect(
      Object.fromEntries(
        LEARNING_PROGRAM_CATALOG.map((program) => [program.key, program.kind])
      )
    ).toMatchObject({
      "cambridge-international": "school-curriculum",
      merdeka: "school-curriculum",
      "singapore-moe": "school-curriculum",
      snbt: "admission-exam",
      tka: "assessment",
      "united-states": "school-curriculum",
    });
  });

  it("stores hierarchy models without enumerating content route coverage", () => {
    const schoolProgram = findLearningProgramByKey("merdeka");
    const cambridgeProgram = findLearningProgramByKey(
      "cambridge-international"
    );
    const singaporeProgram = findLearningProgramByKey("singapore-moe");
    const unitedStatesProgram = findLearningProgramByKey("united-states");
    const examProgram = findLearningProgramByKey("snbt");

    for (const program of [
      schoolProgram,
      cambridgeProgram,
      singaporeProgram,
      unitedStatesProgram,
    ]) {
      expect(program).toBeDefined();
    }

    expect(singaporeProgram?.iconKey).toBe("state");
    expect(schoolProgram?.navigation).toEqual({
      levels: ["stage", "class", "subject", "topic"],
      model: "curriculum-tree",
    });
    expect(examProgram?.navigation).toEqual({
      levels: ["section", "domain", "set"],
      model: "exam-domain-set",
    });
    expect(cambridgeProgram?.navigation).toEqual({
      levels: ["stage", "course", "unit", "lesson"],
      model: "curriculum-tree",
    });
    expect(JSON.stringify(LEARNING_PROGRAM_CATALOG)).not.toContain(
      "curriculum/"
    );
  });

  it("uses direct program lookup without inventing a default curriculum", () => {
    expect(findLearningProgramByKey("snbt")).toMatchObject({
      kind: "admission-exam",
    });
    expect(findLearningProgramByKey("missing-program")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import type { LearningProgramCatalog } from "@/components/programs/contract";
import {
  canContinueOnboardingStep,
  getDefaultProgram,
  getInterestsForProgram,
  getProgramsForInterests,
  getSelectableInterests,
  parseInterests,
} from "@/components/programs/onboarding/model";

const programs = [
  {
    coverageStatus: "available",
    description: "Default STEM path.",
    displayOrder: 10,
    key: "nakafa-stem-path",
    kind: "nakafa-path",
    locale: "id",
    title: "STEM dari dasar",
    versionLabel: "2026",
  },
  {
    coverageStatus: "partial",
    description: "School curriculum.",
    displayOrder: 20,
    key: "id-kurikulum-merdeka",
    kind: "school-curriculum",
    locale: "id",
    title: "Kurikulum Merdeka",
    versionLabel: "Indonesia",
  },
  {
    coverageStatus: "partial",
    description: "Admission exam.",
    displayOrder: 30,
    key: "snbt-2026",
    kind: "admission-exam",
    locale: "id",
    title: "SNBT 2026",
    versionLabel: "2026",
  },
] satisfies LearningProgramCatalog;

describe("components/programs/onboarding/model", () => {
  it("matches selected interests to selectable programs", () => {
    expect(
      getProgramsForInterests(programs, ["school-curriculum"]).map(
        (program) => program.key
      )
    ).toEqual(["id-kurikulum-merdeka"]);
    expect(
      getProgramsForInterests(programs, ["exam-prep", "nakafa-path"]).map(
        (program) => program.key
      )
    ).toEqual(["nakafa-stem-path", "snbt-2026"]);
  });

  it("does not show interests that have no usable program", () => {
    expect(
      getProgramsForInterests(programs, ["assessment-prep"]).map(
        (program) => program.key
      )
    ).toEqual(["snbt-2026"]);
    expect(getProgramsForInterests(programs, [])).toEqual([]);
    expect(
      getSelectableInterests(programs, [
        "school-curriculum",
        "assessment-prep",
        "exam-prep",
        "nakafa-path",
        "custom-plan",
      ])
    ).toEqual([
      "school-curriculum",
      "assessment-prep",
      "exam-prep",
      "nakafa-path",
    ]);
  });

  it("keeps interest parsing and default path selection deterministic", () => {
    expect(parseInterests(["exam-prep"])).toEqual(["exam-prep"]);
    expect(parseInterests(["unknown"])).toEqual([]);
    expect(getDefaultProgram(programs)?.key).toBe("nakafa-stem-path");
    expect(getDefaultProgram([])).toBeNull();
    expect(getInterestsForProgram(null, ["exam-prep"])).toEqual([]);
    expect(
      getInterestsForProgram(
        programs.find((program) => program.key === "snbt-2026") ?? null,
        ["exam-prep", "nakafa-path"]
      )
    ).toEqual(["exam-prep"]);
  });

  it("allows returning learners to continue from a preselected program", () => {
    const selectedProgram =
      programs.find((program) => program.key === "id-kurikulum-merdeka") ??
      null;

    expect(
      canContinueOnboardingStep({
        interests: ["school-curriculum"],
        program: null,
        step: "interests",
      })
    ).toBe(true);
    expect(
      canContinueOnboardingStep({
        interests: [],
        program: selectedProgram,
        step: "interests",
      })
    ).toBe(false);
    expect(
      canContinueOnboardingStep({
        interests: ["school-curriculum"],
        program: selectedProgram,
        step: "program",
      })
    ).toBe(true);
    expect(
      canContinueOnboardingStep({
        interests: ["school-curriculum"],
        program: null,
        step: "program",
      })
    ).toBe(false);
  });
});

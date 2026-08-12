import { describe, expect, it } from "vitest";
import type { LearningProgramCatalog } from "@/components/programs/contract";
import {
  getFocusOptionForKey,
  getFocusOptionsForRole,
  getInitialFocusKey,
  getSelectableRoleOptions,
  hasOnboardingChoices,
  parseOnboardingRole,
  resolveFocusSelection,
} from "@/components/programs/onboarding/model";

const programs = [
  {
    coverageStatus: "partial",
    displayOrder: 10,
    key: "merdeka",
    kind: "school-curriculum",
    navigation: {
      levels: ["stage", "class", "subject", "topic"],
      model: "curriculum-tree",
    },
    publicSlug: "merdeka",
    title: "Kurikulum Merdeka",
    versionLabel: "Indonesia",
  },
  {
    coverageStatus: "partial",
    displayOrder: 20,
    key: "snbt",
    kind: "admission-exam",
    navigation: {
      levels: ["section", "domain", "set"],
      model: "exam-domain-set",
    },
    publicSlug: "snbt",
    title: "SNBT 2026",
    versionLabel: "2026",
  },
] satisfies LearningProgramCatalog;

describe("components/programs/onboarding/model", () => {
  it("parses only normal self-selectable roles", () => {
    expect(parseOnboardingRole("student")).toBe("student");
    expect(parseOnboardingRole("teacher")).toBe("teacher");
    expect(parseOnboardingRole("administrator")).toBeNull();
    expect(parseOnboardingRole("unknown")).toBeNull();
  });

  it("resolves role-specific focus cards to persisted profile selections", () => {
    const studentFocus = getFocusOptionsForRole("student", programs);
    const schoolFocus = getFocusOptionForKey("student", "student-school");
    const examFocus = getFocusOptionForKey("student", "student-exam");

    expect(studentFocus.map((focus) => focus.key)).toEqual([
      "student-school",
      "student-exam",
    ]);
    expect(schoolFocus).not.toBeNull();
    expect(examFocus).not.toBeNull();
    if (!(schoolFocus && examFocus)) {
      return;
    }

    const schoolSelection = resolveFocusSelection(programs, schoolFocus);
    const examSelection = resolveFocusSelection(programs, examFocus);

    expect(schoolSelection).toMatchObject({
      interest: "school-curriculum",
      program: { key: "merdeka" },
    });
    expect(examSelection).toMatchObject({
      interest: "exam-prep",
      program: { key: "snbt" },
    });
  });

  it("filters focus cards that cannot resolve to a selectable program", () => {
    const schoolOnlyCatalog = programs.filter(
      (program) => program.kind === "school-curriculum"
    );

    expect(
      getFocusOptionsForRole("teacher", schoolOnlyCatalog).map(
        (focus) => focus.key
      )
    ).toEqual(["teacher-materials"]);
    expect(getFocusOptionForKey("teacher", "teacher-unsupported")).toBeNull();
    expect(getFocusOptionForKey("teacher", "student-school")).toBeNull();
    expect(hasOnboardingChoices(schoolOnlyCatalog)).toBe(true);
    expect(hasOnboardingChoices([])).toBe(false);
  });

  it("shows only roles that can continue and restores returning selection focus", () => {
    const schoolOnlyCatalog = programs.filter(
      (program) => program.kind === "school-curriculum"
    );
    const selectableRoles = getSelectableRoleOptions(schoolOnlyCatalog);

    expect(selectableRoles.map((role) => role.key)).toEqual([
      "student",
      "teacher",
      "parent",
    ]);
    expect(
      getInitialFocusKey({
        activeSelection: {
          interest: "exam-prep",
          program: programs[1],
        },
        programs,
        role: "student",
      })
    ).toBe("student-exam");
    expect(
      getInitialFocusKey({
        activeSelection: {
          interest: "exam-prep",
          program: {
            ...programs[0],
            key: "retired-learning-path",
          },
        },
        programs,
        role: "teacher",
      })
    ).toBe("");
    expect(
      getInitialFocusKey({
        activeSelection: null,
        programs,
        role: "student",
      })
    ).toBe("");
  });
});

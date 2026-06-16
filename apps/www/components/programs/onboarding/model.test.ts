import { describe, expect, it } from "vitest";
import type { LearningProgramCatalog } from "@/components/programs/contract";
import {
  getFocusOptionForKey,
  getFocusOptionsForRole,
  getInitialFocusKey,
  getProgramsForInterests,
  getRoleOptionForKey,
  getSelectableInterests,
  getSelectableRoleOptions,
  hasOnboardingChoices,
  parseInterests,
  parseOnboardingRole,
  resolveFocusSelection,
} from "@/components/programs/onboarding/model";

const programs = [
  {
    coverageStatus: "partial",
    description: "School curriculum.",
    displayOrder: 10,
    key: "id-kurikulum-merdeka",
    kind: "school-curriculum",
    navigation: {
      levels: ["class", "subject", "topic"],
      model: "class-curriculum-topic",
    },
    title: "Kurikulum Merdeka",
    versionLabel: "Indonesia",
  },
  {
    coverageStatus: "partial",
    description: "Admission exam.",
    displayOrder: 20,
    key: "snbt-2026",
    kind: "admission-exam",
    navigation: {
      levels: ["section", "domain", "practice-set"],
      model: "exam-domain-practice-set",
    },
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

  it("matches selected interests to selectable programs", () => {
    expect(
      getProgramsForInterests(programs, ["school-curriculum"]).map(
        (program) => program.key
      )
    ).toEqual(["id-kurikulum-merdeka"]);
    expect(
      getProgramsForInterests(programs, ["exam-prep", "assessment-prep"]).map(
        (program) => program.key
      )
    ).toEqual(["snbt-2026"]);
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
      ])
    ).toEqual(["school-curriculum", "assessment-prep", "exam-prep"]);
  });

  it("keeps interest parsing deterministic", () => {
    expect(parseInterests(["exam-prep"])).toEqual(["exam-prep"]);
    expect(parseInterests(["unknown"])).toEqual([]);
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
      interests: ["school-curriculum"],
      program: { key: "id-kurikulum-merdeka" },
    });
    expect(examSelection).toMatchObject({
      interests: ["exam-prep"],
      program: { key: "snbt-2026" },
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

  it("shows only roles that can continue and restores returning profile focus", () => {
    const schoolOnlyCatalog = programs.filter(
      (program) => program.kind === "school-curriculum"
    );
    const selectableRoles = getSelectableRoleOptions(schoolOnlyCatalog);

    expect(selectableRoles.map((role) => role.key)).toEqual([
      "student",
      "teacher",
      "parent",
    ]);
    expect(getRoleOptionForKey(selectableRoles, null)).toBeNull();
    expect(getRoleOptionForKey(selectableRoles, "student")).toMatchObject({
      key: "student",
    });
    expect(getRoleOptionForKey([], "student")).toBeNull();
    expect(
      getInitialFocusKey({
        activeProfile: {
          interests: ["exam-prep"],
          planItems: [],
          program: programs[1],
          stage: undefined,
        },
        programs,
        role: "student",
      })
    ).toBe("student-exam");
    expect(
      getInitialFocusKey({
        activeProfile: {
          interests: ["exam-prep"],
          planItems: [],
          program: {
            ...programs[0],
            key: "retired-learning-path",
          },
          stage: undefined,
        },
        programs,
        role: "teacher",
      })
    ).toBe("");
    expect(
      getInitialFocusKey({
        activeProfile: null,
        programs,
        role: "student",
      })
    ).toBe("");
  });
});

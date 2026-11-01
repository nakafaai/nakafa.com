import { describe, expect, it } from "@effect/vitest";
import {
  COHORT_COUNT,
  cohortOf,
  FULL_SCHOOL,
  peopleOf,
  personName,
} from "@repo/backend/scripts/content/acceptance/roll";
import { Array as Arr } from "effect";

describe("acceptance roll", () => {
  it("names every person of a full school differently, the longest within a person's limit", () => {
    const total =
      FULL_SCHOOL.students +
      FULL_SCHOOL.teachers +
      FULL_SCHOOL.guardians +
      FULL_SCHOOL.invites;
    const names = Arr.makeBy(total, personName);

    expect(Arr.dedupe(names)).toHaveLength(total);
    expect(personName(1)).toBe("Agus Akbar");
    expect(personName(0).length).toBeGreaterThan(90);
    expect(Math.max(...Arr.map(names, (name) => name.length))).toBeLessThan(
      121
    );
  });

  it("spreads the cohorts over the three grades of an SMA", () => {
    expect(cohortOf(0)).toEqual({ grade: 10, name: "X-1" });
    expect(cohortOf(7)).toEqual({ grade: 11, name: "XI-1" });
    expect(cohortOf(COHORT_COUNT - 1)).toEqual({ grade: 12, name: "XII-6" });
  });

  it("gives each kind of person its own range of indexes", () => {
    const { guardians, invited, students, teachers } = peopleOf(FULL_SCHOOL);

    expect(students).toHaveLength(FULL_SCHOOL.students);
    expect(teachers[0]).toBe(FULL_SCHOOL.students);
    expect(guardians[0]).toBe(FULL_SCHOOL.students + FULL_SCHOOL.teachers);
    expect(invited).toHaveLength(FULL_SCHOOL.invites);
  });
});

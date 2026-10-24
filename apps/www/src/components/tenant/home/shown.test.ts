import { describe, expect, it } from "@effect/vitest";
import { staffShown, studentShown } from "@/components/tenant/home/shown";

/** The facts of a staff home with nothing in it, which each test changes in the one way it checks. */
const EMPTY_STAFF = {
  canCreate: true,
  canWatch: true,
  closed: 0,
  drafts: 0,
  live: 0,
  next: 0,
  setupShown: false,
};

/** The facts of a student's home with nothing in it, which each test changes in the one way it checks. */
const EMPTY_STUDENT = {
  finished: 0,
  hasNow: false,
  scheduled: 0,
  upcoming: 0,
};

describe("tenant home shown cells", () => {
  it("shows the quiet state and the setup to an owner with no room and no draft", () => {
    expect(staffShown({ ...EMPTY_STAFF, setupShown: true })).toEqual({
      drafts: false,
      live: false,
      quiet: true,
      results: false,
      schedule: false,
      setup: true,
    });
  });

  it("shows the schedule, the live rooms, the results and the drafts, and no quiet state", () => {
    expect(
      staffShown({
        ...EMPTY_STAFF,
        closed: 2,
        drafts: 1,
        live: 1,
        next: 1,
      })
    ).toEqual({
      drafts: true,
      live: true,
      quiet: false,
      results: true,
      schedule: true,
      setup: false,
    });
  });

  it("shows the drafts only to a viewer who may create exams", () => {
    expect(
      staffShown({ ...EMPTY_STAFF, canCreate: false, drafts: 3 }).drafts
    ).toBe(false);
  });

  it("shows no quiet state to a viewer who may not watch rooms", () => {
    expect(staffShown({ ...EMPTY_STAFF, canWatch: false }).quiet).toBe(false);
  });

  it("hides the quiet state, and shows the schedule, while a room opens soon", () => {
    expect(staffShown({ ...EMPTY_STAFF, next: 1 })).toMatchObject({
      quiet: false,
      schedule: true,
    });
  });

  it("shows the now cell, the schedule and the results of a student with a sitting and results", () => {
    expect(
      studentShown({ finished: 2, hasNow: true, scheduled: 1, upcoming: 1 })
    ).toEqual({ now: true, quiet: false, results: true, schedule: true });
  });

  it("shows the next sitting as now without a schedule while it opens beyond the schedule's days", () => {
    expect(
      studentShown({ ...EMPTY_STUDENT, hasNow: true, upcoming: 1 })
    ).toEqual({ now: true, quiet: false, results: false, schedule: false });
  });

  it("shows only the quiet state to a student with no sitting and no result", () => {
    expect(studentShown(EMPTY_STUDENT)).toEqual({
      now: false,
      quiet: true,
      results: false,
      schedule: false,
    });
  });
});

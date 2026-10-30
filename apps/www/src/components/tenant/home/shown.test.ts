import { describe, expect, it } from "@effect/vitest";
import { staffShown, studentShown } from "@/components/tenant/home/shown";

const staff = {
  canCreate: false,
  canWatch: false,
  classes: 0,
  closed: 0,
  drafts: 0,
  live: 0,
  next: 0,
  setupShown: false,
};

describe("tenant home shown cells", () => {
  it("shows the quiet state and the setup to an owner with no room and no draft", () => {
    const shown = staffShown({
      ...staff,
      canCreate: true,
      canWatch: true,
      setupShown: true,
    });
    expect(shown.quiet).toBe(true);
    expect(shown.setup).toBe(true);
    expect(shown.schedule).toBe(false);
    expect(shown.live).toBe(false);
  });

  it("shows the schedule, the live rooms, the results and the drafts, and no quiet state", () => {
    const shown = staffShown({
      ...staff,
      canCreate: true,
      canWatch: true,
      closed: 2,
      drafts: 1,
      live: 1,
      next: 3,
    });
    expect(shown).toMatchObject({
      drafts: true,
      live: true,
      quiet: false,
      results: true,
      schedule: true,
    });
  });

  it("shows the drafts only to a viewer who may create exams", () => {
    expect(staffShown({ ...staff, canWatch: true, drafts: 2 }).drafts).toBe(
      false
    );
    expect(staffShown({ ...staff, canCreate: true, drafts: 2 }).drafts).toBe(
      true
    );
  });

  it("shows the classes once the viewer teaches one, whatever the viewer may do with exams", () => {
    expect(staffShown(staff).classes).toBe(false);
    expect(staffShown({ ...staff, classes: 2 }).classes).toBe(true);
  });

  it("shows no quiet state to a viewer who may not watch rooms", () => {
    expect(staffShown({ ...staff, canCreate: true }).quiet).toBe(false);
  });

  it("hides the quiet state, and shows the schedule, while a room opens soon", () => {
    const shown = staffShown({ ...staff, canWatch: true, next: 1 });
    expect(shown.quiet).toBe(false);
    expect(shown.schedule).toBe(true);
  });

  it("shows the now cell, the schedule and the results of a student with a sitting and results", () => {
    expect(
      studentShown({ classes: 1, finished: 2, hasNow: true, upcoming: 1 })
    ).toStrictEqual({
      classes: true,
      now: true,
      quiet: false,
      results: true,
      schedule: true,
    });
  });

  it("shows the schedule for a sitting still to come, even beyond its fourteen days", () => {
    expect(
      studentShown({ classes: 0, finished: 0, hasNow: true, upcoming: 1 })
        .schedule
    ).toBe(true);
  });

  it("shows only the classes and the quiet state to a student with no sitting and no result", () => {
    expect(
      studentShown({ classes: 1, finished: 0, hasNow: false, upcoming: 0 })
    ).toStrictEqual({
      classes: true,
      now: false,
      quiet: true,
      results: false,
      schedule: false,
    });
  });
});

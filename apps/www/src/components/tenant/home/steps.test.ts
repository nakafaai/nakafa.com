import { describe, expect, it } from "@effect/vitest";
import { missingSteps, type SetupState } from "@/components/tenant/home/steps";

const COMPLETE: SetupState = {
  hasActiveUnit: true,
  hasPendingInvite: false,
  hasStudent: true,
  hasTeacher: true,
};

describe("missingSteps", () => {
  it("lists no step for a school whose setup is complete", () => {
    expect(missingSteps(COMPLETE)).toEqual([]);
  });

  it("lists every step of a school with nothing set up", () => {
    expect(
      missingSteps({
        hasActiveUnit: false,
        hasPendingInvite: false,
        hasStudent: false,
        hasTeacher: false,
      })
    ).toEqual(["unit", "teacher", "students"]);
  });

  it("lists the invites only while one waits to be accepted", () => {
    expect(missingSteps({ ...COMPLETE, hasPendingInvite: true })).toEqual([
      "invites",
    ]);
  });

  it("lists the unit and the teacher of a school with a student only", () => {
    expect(
      missingSteps({ ...COMPLETE, hasActiveUnit: false, hasTeacher: false })
    ).toEqual(["unit", "teacher"]);
  });
});

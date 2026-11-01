import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { landingOf, memberLandingOf } from "@/lib/tenant/landing";

/** A viewer's rights in the school, with none unless a test gives them. */
const rights = (
  given: Partial<{
    canManage: boolean;
    canOpenExams: boolean;
    canOpenReports: boolean;
  }> = {}
) => ({
  canManage: given.canManage ?? false,
  canOpenExams: given.canOpenExams ?? false,
  canOpenReports: given.canOpenReports ?? false,
});

/** Exam access that neither creates nor watches. */
const NO_EXAMS = { canCreate: false, canWatch: false };

describe("tenant/landing", () => {
  it("opens a parent's children", () => {
    expect(
      landingOf({ ...rights(), role: Option.some("guardian") }, NO_EXAMS)
    ).toBe("/school/$slug/parents");
  });

  it("opens the exams for staff who may open them, whatever else they may do", () => {
    expect(
      landingOf(
        {
          ...rights({ canManage: true, canOpenExams: true }),
          role: Option.some("admin"),
        },
        { canCreate: true, canWatch: true }
      )
    ).toBe("/school/$slug/exams");
  });

  it("opens a student's own exams, and a member's with no grant", () => {
    expect(
      landingOf({ ...rights(), role: Option.some("student") }, NO_EXAMS)
    ).toBe("/school/$slug/sittings");
    expect(landingOf({ ...rights(), role: Option.none() }, NO_EXAMS)).toBe(
      "/school/$slug/sittings"
    );
  });

  it("opens the settings for a manager with no exams, the report cards for a teacher who keeps them, else the notifications", () => {
    expect(
      landingOf(
        { ...rights({ canManage: true }), role: Option.some("admin") },
        NO_EXAMS
      )
    ).toBe("/school/$slug/settings/profile");
    expect(
      landingOf(
        { ...rights({ canOpenReports: true }), role: Option.some("teacher") },
        NO_EXAMS
      )
    ).toBe("/school/$slug/reports");
    expect(
      landingOf({ ...rights(), role: Option.some("teacher") }, NO_EXAMS)
    ).toBe("/school/$slug/notifications");
  });

  it("reads a member's rights from the frame the school layout drew", () => {
    expect(
      memberLandingOf({
        home: { ...NO_EXAMS, choices: [] },
        viewer: { can: ["tenant.manage"], grants: [], units: [] },
      })
    ).toBe("/school/$slug/settings/profile");
  });
});

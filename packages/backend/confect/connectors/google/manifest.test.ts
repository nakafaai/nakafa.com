import { describe, expect, it } from "@effect/vitest";
import { grantsConnector } from "@repo/backend/confect/connectors/google/manifest";

const ROOT = "https://www.googleapis.com/auth/";
const COURSES = `${ROOT}classroom.courses.readonly`;
const ROSTERS = `${ROOT}classroom.rosters.readonly`;
const COURSE_WORK = `${ROOT}classroom.coursework.students.readonly`;
const SUBMISSIONS = `${ROOT}classroom.student-submissions.students.readonly`;

describe("connectors/google/manifest grantsConnector", () => {
  it("reads every scope of a connector as granted, without asking for openid", () => {
    expect(grantsConnector("classroom", [COURSES, ROSTERS, COURSE_WORK])).toBe(
      true
    );
  });

  it("reads Classroom's other name for course work as the same access", () => {
    expect(
      grantsConnector("classroom", ["openid", COURSES, ROSTERS, SUBMISSIONS])
    ).toBe(true);
  });

  it("refuses a grant that lacks a scope of the connector", () => {
    expect(grantsConnector("classroom", ["openid", COURSES, ROSTERS])).toBe(
      false
    );
  });
});

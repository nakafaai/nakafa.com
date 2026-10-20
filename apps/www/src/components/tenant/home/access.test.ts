import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Option, Schema } from "effect";
import type { ViewerUnit } from "@/components/tenant/exams/create";
import { homeAccess, showsStudentHome } from "@/components/tenant/home/access";

const unitId = Schema.decodeUnknownSync(Id("tenantUnits"));

/** One active unit of the school, in Indonesian, with the unit actions the viewer holds in it. */
const unit = (id: string, can: ViewerUnit["can"]): ViewerUnit => ({
  can,
  contentLanguage: "id",
  id: unitId(id),
  level: "smp",
  name: `Unit ${id}`,
  status: "active",
  timeZone: "Asia/Jakarta",
});

describe("homeAccess", () => {
  it("gives a viewer with no exam action neither a create nor a watch", () => {
    expect(homeAccess({ can: [], units: [unit("smp", [])] })).toEqual({
      canCreate: false,
      canWatch: false,
      choices: [],
      languages: [],
    });
  });

  it("lets a teacher create in a unit and watch its rooms, with no school choice", () => {
    const smp = unit("smp", ["exam.edit", "exam.rooms"]);

    expect(homeAccess({ can: [], units: [smp] })).toEqual({
      canCreate: true,
      canWatch: true,
      choices: [
        {
          language: "id",
          scope: { kind: "unit", unitId: smp.id },
          unitId: smp.id,
          unitName: smp.name,
        },
      ],
      languages: ["id"],
    });
  });

  it("lets a principal watch the rooms of its unit, but not create an exam", () => {
    const sma = unit("sma", ["exam.rooms"]);

    expect(homeAccess({ can: [], units: [sma] })).toMatchObject({
      canCreate: false,
      canWatch: true,
      choices: [],
    });
  });

  it("offers the whole school first when the viewer may edit the school's exams", () => {
    const smp = unit("smp", ["exam.edit"]);

    expect(
      Arr.map(
        homeAccess({ can: ["exam.edit"], units: [smp] }).choices,
        (choice) => choice.unitId
      )
    ).toEqual([null, smp.id]);
  });
});

describe("showsStudentHome", () => {
  const noGrant = { canManage: false, role: Option.none() } as const;

  it("shows the student's home to a student", () => {
    const smp = unit("smp", ["exam.edit", "exam.rooms"]);

    expect(
      showsStudentHome(
        { canManage: false, role: Option.some("student") },
        homeAccess({ can: [], units: [smp] })
      )
    ).toBe(true);
  });

  it("shows the student's home to a member with no grant, who may neither create nor watch", () => {
    expect(
      showsStudentHome(
        noGrant,
        homeAccess({ can: [], units: [unit("smp", [])] })
      )
    ).toBe(true);
  });

  it("shows the staff home to a teacher who may create and watch", () => {
    const smp = unit("smp", ["exam.edit", "exam.rooms"]);

    expect(
      showsStudentHome(
        { canManage: false, role: Option.some("teacher") },
        homeAccess({ can: [], units: [smp] })
      )
    ).toBe(false);
  });

  it("shows the staff home to a member with no grant who may watch rooms", () => {
    const sma = unit("sma", ["exam.rooms"]);

    expect(
      showsStudentHome(noGrant, homeAccess({ can: [], units: [sma] }))
    ).toBe(false);
  });

  it("shows the staff home to a member with no grant who may create but not watch", () => {
    const smp = unit("smp", ["exam.edit"]);

    expect(
      showsStudentHome(noGrant, homeAccess({ can: [], units: [smp] }))
    ).toBe(false);
  });

  it("shows the staff home, not the student's sentence, to a counselor with no exam action", () => {
    expect(
      showsStudentHome(
        { canManage: false, role: Option.some("counselor") },
        homeAccess({ can: [], units: [unit("smp", [])] })
      )
    ).toBe(false);
  });

  it("keeps a manager on the staff home with no exam action, so its setup stays", () => {
    expect(
      showsStudentHome(
        { canManage: true, role: Option.some("admin") },
        homeAccess({ can: [], units: [unit("smp", [])] })
      )
    ).toBe(false);
  });
});

import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Schema } from "effect";
import type { ViewerUnit } from "@/components/tenant/exams/create";
import { homeAccess } from "@/components/tenant/home/access";

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

import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Option, Schema } from "effect";
import {
  choiceKey,
  creatableUnits,
  defaultChoice,
  scopeChoices,
  unitLanguages,
  type ViewerUnit,
} from "@/components/tenant/exams/create";

const unitId = Schema.decodeUnknownSync(Id("tenantUnits"));

/**
 * One unit of the school as the viewer sees it: active, and open to the exam edit action,
 * unless the test says otherwise.
 */
const unit = (
  id: string,
  contentLanguage: "de" | "en" | "id",
  status: "active" | "archived" = "active",
  can: ViewerUnit["can"] = ["exam.edit"]
): ViewerUnit => ({
  can,
  contentLanguage,
  id: unitId(id),
  level: "sd",
  name: `Unit ${id}`,
  status,
  timeZone: "Asia/Jakarta",
});

const kelas = unit("kelas", "id");
const grade = unit("grade", "en");
const closed = unit("closed", "de", "archived");
const reader = unit("reader", "de", "active", ["unit.view"]);
const units = [kelas, closed, grade];

describe("creatableUnits", () => {
  it("keeps the active units the viewer may edit exams in, in the order the viewer sees them", () => {
    expect(creatableUnits([kelas, closed, reader, grade])).toEqual([
      kelas,
      grade,
    ]);
  });

  it("keeps no archived unit, even one the server lets the viewer edit", () => {
    expect(creatableUnits([closed])).toEqual([]);
  });
});

describe("scopeChoices", () => {
  it("offers the whole school first and then each unit when the viewer may edit the school", () => {
    expect(scopeChoices(units, true)).toEqual([
      {
        language: null,
        scope: { kind: "tenant" },
        unitId: null,
        unitName: null,
      },
      {
        language: "id",
        scope: { kind: "unit", unitId: kelas.id },
        unitId: kelas.id,
        unitName: kelas.name,
      },
      {
        language: "en",
        scope: { kind: "unit", unitId: grade.id },
        unitId: grade.id,
        unitName: grade.name,
      },
    ]);
  });

  it("offers only the units the viewer may edit exams in to a viewer who may not edit the school", () => {
    expect(
      Arr.map(
        scopeChoices([kelas, reader, grade], false),
        (choice) => choice.unitId
      )
    ).toEqual([kelas.id, grade.id]);
  });

  it("offers no whole-school choice when no unit is creatable, since the school takes its language from a unit", () => {
    expect(scopeChoices([closed, reader], true)).toEqual([]);
  });
});

describe("defaultChoice", () => {
  it("chooses the first unit over the whole school", () => {
    const choices = scopeChoices(units, true);

    expect(defaultChoice(choices)).toEqual(Option.some(choices[1]));
  });

  it("chooses the first unit the viewer may edit exams in, not the first unit of the school", () => {
    const choices = scopeChoices([reader, kelas], false);

    expect(defaultChoice(choices)).toEqual(Option.some(choices[0]));
    expect(Option.map(defaultChoice(choices), choiceKey)).toEqual(
      Option.some(kelas.id)
    );
  });

  it("chooses nothing when the viewer can create nowhere, which hides the create action", () => {
    expect(defaultChoice(scopeChoices([closed, reader], false))).toEqual(
      Option.none()
    );
  });
});

describe("a unit teacher", () => {
  it("creates in the one unit where they may edit exams, and that unit's language is the only one offered", () => {
    const teacherUnits = [reader, kelas];

    expect(Arr.map(scopeChoices(teacherUnits, false), choiceKey)).toEqual([
      kelas.id,
    ]);
    expect(unitLanguages(teacherUnits)).toEqual(["id"]);
  });
});

describe("choiceKey", () => {
  it("names the whole school and each unit with a key of its own", () => {
    const choices = scopeChoices(units, true);

    expect(Arr.map(choices, choiceKey)).toEqual(["school", kelas.id, grade.id]);
  });
});

describe("unitLanguages", () => {
  it("lists each language of the units a new exam can be created in once", () => {
    expect(unitLanguages([kelas, grade, unit("kedua", "id")])).toEqual([
      "id",
      "en",
    ]);
  });
});

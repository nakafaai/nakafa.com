import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Option, Schema } from "effect";
import {
  activeUnits,
  choiceKey,
  defaultChoice,
  scopeChoices,
  unitLanguages,
  type ViewerUnit,
} from "@/components/tenant/exams/create";

const unitId = Schema.decodeUnknownSync(Id("tenantUnits"));

/** One unit of the school, active unless the test says otherwise. */
const unit = (
  id: string,
  contentLanguage: "de" | "en" | "id",
  status: "active" | "archived" = "active"
): ViewerUnit => ({
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
const units = [kelas, closed, grade];

describe("activeUnits", () => {
  it("keeps the active units in the order the viewer sees them", () => {
    expect(activeUnits(units)).toEqual([kelas, grade]);
  });
});

describe("scopeChoices", () => {
  it("offers the whole school first and then each active unit when the viewer may edit the school", () => {
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

  it("offers only the active units to a viewer who may not edit the school", () => {
    expect(
      Arr.map(scopeChoices(units, false), (choice) => choice.unitId)
    ).toEqual([kelas.id, grade.id]);
  });
});

describe("defaultChoice", () => {
  it("chooses the first unit over the whole school", () => {
    const choices = scopeChoices(units, true);

    expect(defaultChoice(choices)).toEqual(Option.some(choices[1]));
  });

  it("chooses the whole school when the school has no active unit", () => {
    const choices = scopeChoices([closed], true);

    expect(defaultChoice(choices)).toEqual(Option.some(choices[0]));
  });

  it("chooses nothing when the viewer can create nowhere", () => {
    expect(defaultChoice(scopeChoices([closed], false))).toEqual(Option.none());
  });
});

describe("choiceKey", () => {
  it("names the whole school and each unit with a key of its own", () => {
    const choices = scopeChoices(units, true);

    expect(Arr.map(choices, choiceKey)).toEqual(["school", kelas.id, grade.id]);
  });
});

describe("unitLanguages", () => {
  it("lists each language of the active units once", () => {
    expect(unitLanguages([kelas, grade, unit("kedua", "id")])).toEqual([
      "id",
      "en",
    ]);
  });
});

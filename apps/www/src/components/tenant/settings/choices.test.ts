import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import {
  chosenGrade,
  countryChoices,
  gradeItemsOf,
  timeZoneItems,
} from "@/components/tenant/settings/choices";

describe("components/tenant/settings/choices", () => {
  it("names only the countries a school may save, so no flag subdivision throws", () => {
    for (const locale of ["id", "en", "de"]) {
      const items = countryChoices(locale);
      const values = Arr.map(items, (item) => item.value);

      expect(values).toContain("ID");
      expect(values).not.toContain("GB-ENG");
      expect(values).not.toContain("ES-CT");
      expect(Arr.every(values, (value) => value.length === 2)).toBe(true);
      expect(Arr.every(items, (item) => item.label.length > 0)).toBe(true);
    }
    expect(countryChoices("de")).toContainEqual({
      label: "Deutschland",
      value: "DE",
    });
  });

  it("offers each platform time zone under its own name", () => {
    expect(timeZoneItems).toContainEqual({
      label: "Asia/Jakarta",
      value: "Asia/Jakarta",
    });
  });

  it("offers a cohort the school years of its unit's level, from the lowest to the highest", () => {
    expect(Arr.map(gradeItemsOf("sd"), (item) => item.value)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
    expect(Arr.map(gradeItemsOf("sma"), (item) => item.label)).toEqual([
      "10",
      "11",
      "12",
    ]);
  });

  it("reads the school year a grade choice holds, and none for no choice or one out of range", () => {
    expect(chosenGrade("7")).toStrictEqual(Option.some(7));
    expect(chosenGrade(null)).toStrictEqual(Option.none());
    expect(chosenGrade("14")).toStrictEqual(Option.none());
  });
});

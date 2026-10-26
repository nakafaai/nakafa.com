import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  gradeItems,
  languageItems,
  timeZoneItems,
} from "@/components/tenant/settings/choices";

describe("components/tenant/settings/choices", () => {
  it("offers each platform time zone under its own name", () => {
    expect(timeZoneItems).toContainEqual({
      label: "Asia/Jakarta",
      value: "Asia/Jakarta",
    });
  });

  it("offers each page language of the platform under its label", () => {
    expect(languageItems).toContainEqual(
      expect.objectContaining({ value: "id" })
    );
    expect(Arr.every(languageItems, (item) => item.label.length > 0)).toBe(
      true
    );
  });

  it("offers each school year a cohort may hold, from the lowest to the highest", () => {
    expect(Arr.map(gradeItems, (item) => item.value)).toEqual(
      Arr.makeBy(13, (index) => String(index + 1))
    );
    expect(Arr.every(gradeItems, (item) => item.label === item.value)).toBe(
      true
    );
  });
});

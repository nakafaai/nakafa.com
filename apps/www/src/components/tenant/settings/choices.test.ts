import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
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

  it("offers each content language of the platform under its label", () => {
    expect(languageItems).toContainEqual(
      expect.objectContaining({ value: "id" })
    );
    expect(Arr.every(languageItems, (item) => item.label.length > 0)).toBe(
      true
    );
  });
});

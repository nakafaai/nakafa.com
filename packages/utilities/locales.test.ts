import {
  defaultLocale,
  fieldsForEveryLocale,
  locales,
} from "@repo/utilities/locales";
import { describe, expect, it } from "vitest";

describe("locales", () => {
  it("uses a supported locale as the default", () => {
    expect(locales).toContain(defaultLocale);
  });

  it("keeps supported locales unique", () => {
    expect(new Set(locales).size).toBe(locales.length);
  });

  it("builds one required field for every supported locale", () => {
    expect(fieldsForEveryLocale("value")).toEqual({
      en: "value",
      id: "value",
    });
  });
});

// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  getLocaleOrThrow,
  isBareSchoolPage,
  isSchoolTreePath,
  pathLocale,
} from "@/lib/routing/locale/address";

describe("pathLocale", () => {
  it.each([
    ["/id/school", Option.some("id")],
    ["/en", Option.some("en")],
    ["/de/quran/2", Option.some("de")],
    ["/school", Option.none()],
    ["/fr/subjects", Option.none()],
    ["/", Option.none()],
  ])("reads the locale that %s names in front", (path, locale) => {
    expect(pathLocale(path)).toStrictEqual(locale);
  });
});

describe("isSchoolTreePath", () => {
  it.each([
    "/school/harapan",
    "/school/harapan/exams/abc",
    "/school/new/extra",
    "/school/pricing/extra",
    "/id/school/pricing/extra",
    "/id/school/harapan",
    "/%73chool/harapan",
  ])("names a school tree page at %s", (path) => {
    expect(isSchoolTreePath(path)).toBe(true);
  });

  it.each([
    "/",
    "/id",
    "/exams",
    "/school",
    "/school/new",
    "/school/pricing",
    "/school/enter",
    "/id/school/new",
    "/id/school",
    "/id/school/pricing",
    "/en/school/enter",
    "/school%E0%A4%A",
  ])("does not name a school tree page at %s", (path) => {
    expect(isSchoolTreePath(path)).toBe(false);
  });
});

describe("isBareSchoolPage", () => {
  it.each([
    "/school",
    "/school/pricing",
    "/school/enter",
    "/school/new",
    "/%73chool/pricing",
  ])("names %s a main host's School page without a locale", (path) => {
    expect(isBareSchoolPage(path)).toBe(true);
  });

  it.each([
    "/id/school",
    "/en/school/pricing",
    "/school/harapan",
    "/school/pricing/extra",
    "/schools",
    "/",
  ])("does not name %s one", (path) => {
    expect(isBareSchoolPage(path)).toBe(false);
  });
});

describe("getLocaleOrThrow", () => {
  it("returns every public locale of the contract", () => {
    expect(getLocaleOrThrow("en")).toBe("en");
    expect(getLocaleOrThrow("id")).toBe("id");
    expect(getLocaleOrThrow("de")).toBe("de");
  });

  it("answers a locale outside the contract with the router's not-found", () => {
    expect(() => getLocaleOrThrow("fr")).toThrow();
    expect(() => getLocaleOrThrow("")).toThrow();
  });
});

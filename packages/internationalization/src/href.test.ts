import { describe, expect, it } from "@effect/vitest";
import {
  normalizeLocalizedInternalHref,
  splitLocalePathname,
} from "@repo/internationalization/src/href";

const TEST_LOCALES = ["de", "en", "id"] as const;

describe("localized internal href normalization", () => {
  it.each([
    ["", ""],
    ["#section", "#section"],
    ["mailto:hello@nakafa.com", "mailto:hello@nakafa.com"],
    ["tel:+49123456789", "tel:+49123456789"],
    ["//cdn.nakafa.com/file", "//cdn.nakafa.com/file"],
    ["http://localhost:3000/de/home", "http://localhost:3000/de/home"],
    ["https://nakafa.com/de/home", "https://nakafa.com/de/home"],
  ])("leaves bypass href %s unchanged", (href, expected) => {
    expect(normalizeLocalizedInternalHref(href)).toBe(expected);
  });

  it.each([
    ["/en/subjects/mathematics", "/subjects/mathematics"],
    ["/id/materi/matematika", "/materi/matematika"],
    ["/de/faecher/mathematik", "/faecher/mathematik"],
    ["/de?source=preview#lesson", "/?source=preview#lesson"],
    ["curriculum/merdeka", "/curriculum/merdeka"],
    ["/search?q=function", "/search?q=function"],
  ])("normalizes internal href %s", (href, expected) => {
    expect(normalizeLocalizedInternalHref(href)).toBe(expected);
  });
});

describe("splitLocalePathname", () => {
  it.each([
    ["/en/subjects/mathematics", "en", ["subjects", "mathematics"]],
    ["/id", "id", []],
    ["//de//faecher/", "de", ["faecher"]],
    ["/subjects/mathematics", undefined, ["subjects", "mathematics"]],
    ["/xx/home", undefined, ["xx", "home"]],
    ["/", undefined, []],
  ])(
    "splits pathname %s at its leading locale",
    (pathname, locale, segments) => {
      expect(splitLocalePathname(pathname, TEST_LOCALES)).toEqual({
        locale,
        publicSegments: segments,
      });
    }
  );
});

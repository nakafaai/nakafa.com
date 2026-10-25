import { describe, expect, it } from "@effect/vitest";
import {
  publicSegment,
  readCanonicalName,
  readCanonicalSpelling,
} from "@repo/internationalization/src/pathnames";
import { Option } from "effect";

describe("route map spellings", () => {
  it.each([
    ["curricula", "en", "curriculum"],
    ["curricula", "id", "kurikulum"],
    ["curricula", "de", "lehrplaene"],
    ["materials", "en", "subjects"],
    ["materials", "id", "materi"],
    ["materials", "de", "faecher"],
  ] as const)("spells %s in %s as %s", (canonical, locale, spelling) => {
    expect(publicSegment(canonical, locale)).toBe(spelling);
  });
});

describe("canonical segment names", () => {
  it("names the router's canonical segments", () => {
    expect(readCanonicalName("curricula")).toStrictEqual(
      Option.some("curricula")
    );
    expect(readCanonicalName("materials")).toStrictEqual(
      Option.some("materials")
    );
  });

  it("does not name a public spelling as a canonical segment", () => {
    expect(Option.isNone(readCanonicalName("subjects"))).toBe(true);
    expect(Option.isNone(readCanonicalName("curriculum"))).toBe(true);
  });
});

describe("canonical segment of a spelling", () => {
  it.each([
    ["en", "curriculum", "curricula"],
    ["id", "kurikulum", "curricula"],
    ["de", "faecher", "materials"],
    ["en", "subjects", "materials"],
  ] as const)("reads %s spelling %s as %s", (locale, spelling, canonical) => {
    expect(readCanonicalSpelling(locale, spelling)).toStrictEqual(
      Option.some(canonical)
    );
  });

  it("refuses a spelling that another locale uses", () => {
    expect(Option.isNone(readCanonicalSpelling("id", "subjects"))).toBe(true);
    expect(Option.isNone(readCanonicalSpelling("en", "materi"))).toBe(true);
  });
});

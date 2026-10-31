import { describe, expect, it } from "@effect/vitest";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import { readSchoolAddress, schoolEntryOf } from "@/lib/tenant/entry";

const HARAPAN = Schema.decodeSync(TenantSlug)("harapan");

describe("tenant/entry", () => {
  it("reads a bare address, a host and a whole link as one school", () => {
    for (const typed of [
      "harapan",
      " Harapan ",
      "harapan.nakafa.com",
      "https://harapan.nakafa.com/join?code=ABC",
    ]) {
      expect(readSchoolAddress(typed)).toStrictEqual(Option.some(HARAPAN));
    }
  });

  it("reads nothing from text that names no school", () => {
    for (const typed of ["", "www", "a b", "nakafa.com", "https://", "x"]) {
      expect(Option.isNone(readSchoolAddress(typed))).toBe(true);
    }
  });

  it("leads an account with a school into it, whatever its role", () => {
    expect(schoolEntryOf(Option.some(HARAPAN), "student")).toStrictEqual({
      _tag: "Enter",
      slug: HARAPAN,
    });
  });

  it("leads an account that teaches to opening a school", () => {
    expect(schoolEntryOf(Option.none(), "teacher")).toStrictEqual({
      _tag: "Open",
    });
    expect(schoolEntryOf(Option.none(), "administrator")).toStrictEqual({
      _tag: "Open",
    });
  });

  it("leads a student, a parent and an unknown role to the form", () => {
    expect(schoolEntryOf(Option.none(), "student")).toStrictEqual({
      _tag: "Join",
      guardian: false,
    });
    expect(schoolEntryOf(Option.none(), "parent")).toStrictEqual({
      _tag: "Join",
      guardian: true,
    });
    expect(schoolEntryOf(Option.none(), undefined)).toStrictEqual({
      _tag: "Join",
      guardian: false,
    });
  });
});

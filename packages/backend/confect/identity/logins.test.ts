import { describe, expect, it } from "@effect/vitest";
import { readLoginName } from "@repo/backend/confect/identity/logins";
import { Result } from "effect";

describe("identity/logins readLoginName", () => {
  it("reads a name as lowercase, with the spaces around it dropped", () => {
    expect(readLoginName(" Raka.P-2 ")).toEqual(Result.succeed("raka.p-2"));
  });

  it("refuses a name outside the length the school may use", () => {
    expect(readLoginName("ab")).toEqual(Result.fail("length"));
    expect(readLoginName("a".repeat(33))).toEqual(Result.fail("length"));
    expect(readLoginName("abc")).toEqual(Result.succeed("abc"));
    expect(readLoginName("a".repeat(32))).toEqual(
      Result.succeed("a".repeat(32))
    );
  });

  it("refuses a name with a character outside lowercase letters, digits, dots, underscores, and hyphens", () => {
    expect(readLoginName("raka pratama")).toEqual(Result.fail("characters"));
    expect(readLoginName("raka!!")).toEqual(Result.fail("characters"));
  });

  it.each([
    "admin",
    "Admin",
    "nina",
    "settings",
    "sekolah",
    "operator",
    "root",
    "login",
  ])("refuses the name %s that could pass for Nakafa, in any case", (name) => {
    expect(readLoginName(name)).toEqual(Result.fail("reserved"));
  });

  it("accepts a route word, because a school login name is never a URL", () => {
    expect(readLoginName("materi")).toEqual(Result.succeed("materi"));
  });
});

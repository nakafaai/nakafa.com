import { describe, expect, it } from "@effect/vitest";
import { isSchoolTreePath } from "@/lib/routing/school/tree";

describe("school tree paths", () => {
  it.each([
    "/school",
    "/school/harapan",
    "/school/harapan/classes/fisika-x-1",
    "/id/school",
    "/id/school/harapan",
    "/en/school/harapan/people",
  ])("recognizes %s as a school path", (pathname) => {
    expect(isSchoolTreePath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/id",
    "/id/materi/school",
    "/schools",
    "/school-old",
    "/xx/school",
    "/id/user/settings",
  ])("leaves %s to the public routes", (pathname) => {
    expect(isSchoolTreePath(pathname)).toBe(false);
  });
});

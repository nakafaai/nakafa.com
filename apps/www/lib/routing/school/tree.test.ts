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
    "/%73chool/harapan",
    "/id/%73chool/harapan",
    "/%69d/school/harapan",
    "/%69d/%73chool/harapan",
    "/id/school/new/extra",
    "/id/school/harapan/new",
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
    "/%E0%A4%A/school",
    "/id/%E0%A4%A",
    "/id/%2573chool/harapan",
    "/school/new",
    "/id/school/new",
    "/en/%73chool/ne%77",
  ])("leaves %s to the public routes", (pathname) => {
    expect(isSchoolTreePath(pathname)).toBe(false);
  });
});

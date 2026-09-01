import { describe, expect, it } from "@effect/vitest";
import {
  isReservedSchoolSlug,
  SCHOOL_ROUTE_SLUGS,
} from "@repo/backend/convex/schools/slug";

describe("schools/slug", () => {
  it("owns the static School route tokens", () => {
    expect(SCHOOL_ROUTE_SLUGS).toEqual({
      onboarding: "onboarding",
      select: "select",
    });
    expect(isReservedSchoolSlug("onboarding")).toBe(true);
    expect(isReservedSchoolSlug("select")).toBe(true);
    expect(isReservedSchoolSlug("select-1")).toBe(false);
  });
});

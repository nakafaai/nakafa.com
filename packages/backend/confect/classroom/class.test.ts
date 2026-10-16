import { describe, expect, it } from "@effect/vitest";
import {
  classNameKey,
  classNameOf,
  classSlugOf,
} from "@repo/backend/confect/classroom/class";

describe("classroom/class names", () => {
  it("names a class for its subject and its cohort", () => {
    expect(classNameOf("X-1", "Fisika")).toBe("Fisika X-1");
  });

  it("names a homeroom class without a subject for its cohort alone", () => {
    expect(classNameOf("X-1", undefined)).toBe("X-1");
  });

  it("compares names in lowercase", () => {
    expect(classNameKey("Fisika X-1")).toBe("fisika x-1");
  });
});

describe("classroom/class addresses", () => {
  it("joins the letters and digits of a name with single hyphens", () => {
    expect(classSlugOf("Fisika  X-1")).toBe("fisika-x-1");
  });

  it("keeps the letters of every script", () => {
    expect(classSlugOf("فيزياء X-1")).toBe("فيزياء-x-1");
  });

  it("leaves no address for a name with no letter or digit", () => {
    expect(classSlugOf("!! ??")).toBe("");
  });
});

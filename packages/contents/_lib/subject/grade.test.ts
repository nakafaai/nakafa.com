import {
  getGradeNonNumeric,
  getGradePath,
  parseGrade,
} from "@repo/contents/_lib/subject/grade";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

describe("subject grade helpers", () => {
  it("builds grade routes and resolves grade labels", () => {
    expect(getGradePath("high-school", "10")).toBe("/subject/high-school/10");
    expect(Option.getOrUndefined(getGradeNonNumeric("bachelor"))).toBe(
      "bachelor"
    );
    expect(Option.isNone(getGradeNonNumeric("10"))).toBe(true);
  });

  it("parses valid grade segments and rejects invalid ones", () => {
    expect(Option.getOrUndefined(parseGrade("10"))).toBe("10");
    expect(Option.getOrUndefined(parseGrade("bachelor"))).toBe("bachelor");
    expect(Option.isNone(parseGrade("not-a-grade"))).toBe(true);
  });
});

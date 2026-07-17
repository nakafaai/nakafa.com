import { getGradeNonNumeric } from "@repo/contents/_lib/curriculum/grade";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

describe("subject grade helpers", () => {
  it("resolves grade labels", () => {
    expect(Option.getOrUndefined(getGradeNonNumeric("bachelor"))).toBe(
      "bachelor"
    );
    expect(Option.isNone(getGradeNonNumeric("10"))).toBe(true);
  });
});

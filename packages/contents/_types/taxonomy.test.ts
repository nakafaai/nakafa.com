import { describe, expect, it } from "@effect/vitest";
import { GradeSchema, MaterialSchema } from "@repo/contents/_types/taxonomy";
import { Schema } from "effect";

describe("content taxonomy", () => {
  it("decodes owned grade and material values", () => {
    expect(Schema.decodeSync(GradeSchema)("12")).toBe("12");
    expect(Schema.decodeSync(MaterialSchema)("mathematics")).toBe(
      "mathematics"
    );
  });

  it("rejects values outside the owned taxonomy", () => {
    expect(() => Schema.decodeUnknownSync(GradeSchema)("13")).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(MaterialSchema)("astrology")
    ).toThrow();
  });
});

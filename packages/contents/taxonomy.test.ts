import { describe, expect, it } from "@effect/vitest";
import {
  GradeSchema,
  isPresentedMaterialDomain,
  MaterialSchema,
} from "@repo/contents/taxonomy";
import { Schema } from "effect";

describe("content taxonomy", () => {
  it("decodes owned grade and material values", () => {
    expect(Schema.decodeSync(GradeSchema)("12")).toBe("12");
    expect(Schema.decodeSync(MaterialSchema)("mathematics")).toBe(
      "mathematics"
    );
  });

  it("tells a presented material domain from any other key", () => {
    expect(isPresentedMaterialDomain("mathematics")).toBe(true);
    expect(isPresentedMaterialDomain("astrology")).toBe(false);
  });

  it("rejects values outside the owned taxonomy", () => {
    expect(() => Schema.decodeUnknownSync(GradeSchema)("13")).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(MaterialSchema)("astrology")
    ).toThrow();
  });
});

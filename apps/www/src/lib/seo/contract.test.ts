import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { SEOContextSchema, SEOMetadataSchema } from "@/lib/seo/contract";

describe("SEO contract", () => {
  it("decodes an owned material context and metadata projection", () => {
    expect(
      Schema.decodeSync(SEOContextSchema)({
        type: "material-lesson",
        data: { title: "Functions" },
        grade: "12",
        material: "mathematics",
      })
    ).toMatchObject({ type: "material-lesson", grade: "12" });
    expect(
      Schema.decodeSync(SEOMetadataSchema)({
        description: "Learn functions.",
        keywords: ["functions"],
        title: "Functions",
      })
    ).toMatchObject({ title: "Functions" });
  });

  it("rejects a material context outside the owned taxonomy", () => {
    expect(() =>
      Schema.decodeUnknownSync(SEOContextSchema)({
        type: "material-lesson",
        data: {},
        grade: "13",
        material: "astrology",
      })
    ).toThrow();
  });
});

import { LessonMaterialSourceSchema } from "@repo/contents/_types/material/schema";
import { Either, ParseResult, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("material schema", () => {
  it("rejects invalid authored material routes", () => {
    const result = Schema.decodeUnknownEither(LessonMaterialSourceSchema)({
      ...validLessonSource(),
      assetRoot: "/material/lesson/mathematics/exponents",
    });

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) {
      return;
    }

    expect(ParseResult.TreeFormatter.formatErrorSync(result.left)).toContain(
      "Invalid material route."
    );
  });

  it("rejects invalid material keys and section slugs", () => {
    const source = validLessonSource();
    const invalidKey = Schema.decodeUnknownEither(LessonMaterialSourceSchema)({
      ...source,
      key: "lesson/mathematics/exponents",
    });
    const invalidSlug = Schema.decodeUnknownEither(LessonMaterialSourceSchema)({
      ...source,
      sections: [
        {
          routeSlugs: { en: "invalid", id: "invalid" },
          slug: "InvalidSlug",
          translations: {
            en: { title: "Invalid" },
            id: { title: "Invalid" },
          },
        },
      ],
    });

    expect(Either.isLeft(invalidKey)).toBe(true);
    expect(Either.isLeft(invalidSlug)).toBe(true);

    if (Either.isLeft(invalidKey)) {
      expect(
        ParseResult.TreeFormatter.formatErrorSync(invalidKey.left)
      ).toContain("Invalid material key.");
    }
    if (Either.isLeft(invalidSlug)) {
      expect(
        ParseResult.TreeFormatter.formatErrorSync(invalidSlug.left)
      ).toContain("Invalid material slug.");
    }
  });
});

/** Builds one valid authored source so each test changes only its target field. */
function validLessonSource() {
  return {
    assetRoot: "material/lesson/mathematics/exponents",
    domain: "mathematics",
    kind: "lesson",
    key: "lesson.mathematics.exponents",
    routeSlugs: { en: "exponents", id: "eksponen" },
    sections: [],
    slug: "exponents",
    translations: {
      en: { description: "Read exponent patterns.", title: "Exponents" },
      id: { description: "Baca pola eksponen.", title: "Eksponen" },
    },
  };
}

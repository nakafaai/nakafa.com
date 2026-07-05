import { MATERIAL_CARD_DESCRIPTION_MAX_LENGTH } from "@repo/contents/_types/material/description";
import { normalizeMaterialRoute } from "@repo/contents/_types/material/projection";
import {
  findLessonMaterial,
  getLessonMaterialList,
  listLessonMaterialSources,
  listLessonRows,
  listMaterials,
} from "@repo/contents/_types/material/registry";
import {
  defineLessonMaterial,
  LessonMaterialSourceSchema,
} from "@repo/contents/_types/material/schema";
import { locales } from "@repo/utilities/locales";
import { Either, ParseResult, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("material registry", () => {
  it("projects lesson materials into localized navigation", () => {
    const idMaterials = getLessonMaterialList(
      "material/lesson/mathematics/exponential-logarithm",
      "id"
    );
    const enMaterials = getLessonMaterialList(
      "/material/lesson/mathematics/exponential-logarithm",
      "en"
    );

    expect(idMaterials[0]).toMatchObject({
      href: "/material/lesson/mathematics/exponential-logarithm",
      title: "Eksponen dan Logaritma",
    });
    expect(enMaterials[0]).toMatchObject({
      href: "/material/lesson/mathematics/exponential-logarithm",
      title: "Exponents and Logarithms",
    });
    expect(idMaterials[0]?.items[0]).toEqual({
      href: "/material/lesson/mathematics/exponential-logarithm/basic-concept",
      title: "Konsep Eksponen",
    });
  });

  it("projects sync-ready lesson rows for both supported content languages", () => {
    const lessonRows = listLessonRows();

    expect(lessonRows.some((lesson) => lesson.locale === "id")).toBe(true);
    expect(lessonRows.some((lesson) => lesson.locale === "en")).toBe(true);
    expect(listLessonRows("id").every((lesson) => lesson.locale === "id")).toBe(
      true
    );
  });

  it("keeps lesson material keys and asset roots unique", () => {
    const materials = listMaterials();
    const keys = new Set(materials.map((material) => material.key));
    const assetRoots = new Set(materials.map((material) => material.assetRoot));

    expect(keys.size).toBe(materials.length);
    expect(assetRoots.size).toBe(materials.length);
    expect(listLessonMaterialSources()).not.toHaveLength(0);
  });

  it("keeps authored material card descriptions concise", () => {
    for (const material of listMaterials()) {
      for (const locale of locales) {
        const description = material.translations[locale].description;

        expect(description?.trim()).toBe(description);
        expect(description).toBeTruthy();
        expect(description?.length).toBeLessThanOrEqual(
          MATERIAL_CARD_DESCRIPTION_MAX_LENGTH
        );
      }
    }
  });

  it("finds lesson materials by route", () => {
    expect(
      findLessonMaterial(
        "material/lesson/mathematics/exponential-logarithm/basic-concept"
      )?.key
    ).toBe("lesson.mathematics.exponential-logarithm");
    expect(findLessonMaterial("material/not-found")).toBeNull();
    expect(getLessonMaterialList("material/not-found", "id")).toEqual([]);
  });

  it("projects custom typed lesson source chunks with required card descriptions", () => {
    const lesson = defineLessonMaterial({
      assetRoot: "material/lesson/biology/custom-topic",
      domain: "biology",
      kind: "lesson",
      key: "lesson.biology.custom-topic",
      routeSlugs: { en: "custom-topic", id: "topik-khusus" },
      sections: [],
      slug: "custom-topic",
      translations: {
        en: {
          description: "Read custom biology ideas.",
          title: "Custom Topic",
        },
        id: { description: "Baca ide biologi khusus.", title: "Topik Khusus" },
      },
    });

    expect(
      getLessonMaterialList("material/lesson/biology/custom-topic", "en", [
        lesson,
      ])
    ).toEqual([
      {
        description: "Read custom biology ideas.",
        href: "/material/lesson/biology/custom-topic",
        items: [],
        title: "Custom Topic",
      },
    ]);
    expect(
      normalizeMaterialRoute("//material/lesson/biology/custom-topic/")
    ).toBe("material/lesson/biology/custom-topic");
  });

  it("rejects invalid authored material routes through the Effect Schema contract", () => {
    const result = Schema.decodeUnknownEither(LessonMaterialSourceSchema)({
      assetRoot: "/material/lesson/mathematics/exponents",
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
    });

    expect(Either.isLeft(result)).toBe(true);

    if (Either.isLeft(result)) {
      expect(ParseResult.TreeFormatter.formatErrorSync(result.left)).toContain(
        "Invalid material route."
      );
    }
  });

  it("rejects invalid material keys and section slugs through the schema contract", () => {
    const invalidKey = Schema.decodeUnknownEither(LessonMaterialSourceSchema)({
      assetRoot: "material/lesson/mathematics/exponents",
      domain: "mathematics",
      kind: "lesson",
      key: "lesson/mathematics/exponents",
      routeSlugs: { en: "exponents", id: "eksponen" },
      sections: [],
      slug: "exponents",
      translations: {
        en: { description: "Read exponent patterns.", title: "Exponents" },
        id: { description: "Baca pola eksponen.", title: "Eksponen" },
      },
    });
    const invalidSlug = Schema.decodeUnknownEither(LessonMaterialSourceSchema)({
      assetRoot: "material/lesson/mathematics/exponents",
      domain: "mathematics",
      kind: "lesson",
      key: "lesson.mathematics.exponents",
      routeSlugs: { en: "exponents", id: "eksponen" },
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
      slug: "exponents",
      translations: {
        en: { description: "Read exponent patterns.", title: "Exponents" },
        id: { description: "Baca pola eksponen.", title: "Eksponen" },
      },
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

import {
  listPracticeMaterialSets,
  normalizeMaterialRoute,
  toPracticeMaterialList,
} from "@repo/contents/_types/material/projection";
import {
  findLessonMaterial,
  findPracticeMaterial,
  getLessonMaterialList,
  getPracticeMaterialList,
  listLessonMaterialSources,
  listLessonRows,
  listMaterials,
  listPracticeMaterialSources,
  listPracticeSets,
} from "@repo/contents/_types/material/registry";
import {
  defineLessonMaterial,
  definePracticeMaterial,
  LessonMaterialSourceSchema,
} from "@repo/contents/_types/material/schema";
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

  it("projects practice materials into localized set navigation", () => {
    const materials = getPracticeMaterialList(
      "material/practice/assessment/snbt/quantitative-knowledge",
      "en"
    );

    expect(materials).toHaveLength(1);
    expect(materials[0]).toMatchObject({
      href: "/material/practice/assessment/snbt/quantitative-knowledge/try-out-2026",
      title: "Try Out 2026",
    });
    expect(materials[0]?.items).toHaveLength(10);
    expect(materials[0]?.items[0]).toEqual({
      href: "/material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
      title: "Set 1",
    });
  });

  it("projects sync-ready rows for both supported content languages", () => {
    const lessonRows = listLessonRows();
    const practiceSets = listPracticeSets();

    expect(lessonRows.some((lesson) => lesson.locale === "id")).toBe(true);
    expect(lessonRows.some((lesson) => lesson.locale === "en")).toBe(true);
    expect(
      practiceSets.some(
        (set) =>
          set.locale === "en" &&
          set.slug ===
            "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1"
      )
    ).toBe(true);

    expect(listLessonRows("id").every((lesson) => lesson.locale === "id")).toBe(
      true
    );
    expect(listPracticeSets("id").every((set) => set.locale === "id")).toBe(
      true
    );
  });

  it("keeps material keys and asset roots unique", () => {
    const materials = listMaterials();
    const keys = new Set(materials.map((material) => material.key));
    const assetRoots = new Set(materials.map((material) => material.assetRoot));

    expect(keys.size).toBe(materials.length);
    expect(assetRoots.size).toBe(materials.length);
    expect(listLessonMaterialSources()).not.toHaveLength(0);
    expect(listPracticeMaterialSources()).not.toHaveLength(0);
  });

  it("finds concrete materials by route without exposing the wrong material kind", () => {
    expect(
      findLessonMaterial(
        "material/lesson/mathematics/exponential-logarithm/basic-concept"
      )?.key
    ).toBe("lesson.mathematics.exponential-logarithm");
    expect(
      findPracticeMaterial(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1"
      )?.key
    ).toBe("practice.assessment.snbt.quantitative-knowledge");
    expect(findLessonMaterial("material/practice/assessment/snbt")).toBeNull();
    expect(findPracticeMaterial("material/lesson/mathematics")).toBeNull();
    expect(getLessonMaterialList("material/not-found", "id")).toEqual([]);
    expect(getPracticeMaterialList("material/not-found", "en")).toEqual([]);
  });

  it("projects custom typed source chunks without optional descriptions", () => {
    const lesson = defineLessonMaterial({
      assetRoot: "material/lesson/biology/custom-topic",
      domain: "biology",
      kind: "lesson",
      key: "lesson.biology.custom-topic",
      sections: [],
      slug: "custom-topic",
      translations: {
        en: { title: "Custom Topic" },
        id: { title: "Topik Khusus" },
      },
    });
    const practice = definePracticeMaterial({
      assessment: "snbt",
      assetRoot: "material/practice/assessment/snbt/fixture-domain",
      domain: "general-reasoning",
      groups: [
        {
          exerciseType: "practice",
          sets: [
            {
              slug: "set-1",
              translations: {
                en: { title: "Set 1" },
                id: { title: "Set 1" },
              },
            },
          ],
          translations: {
            en: { title: "Practice" },
            id: { title: "Latihan" },
          },
        },
      ],
      kind: "practice",
      key: "practice.assessment.snbt.fixture-domain",
    });

    expect(
      getLessonMaterialList("material/lesson/biology/custom-topic", "en", [
        lesson,
      ])
    ).toEqual([
      {
        href: "/material/lesson/biology/custom-topic",
        items: [],
        title: "Custom Topic",
      },
    ]);
    expect(
      getPracticeMaterialList(
        "material/practice/assessment/snbt/fixture-domain",
        "id",
        [practice]
      )
    ).toEqual([
      {
        href: "/material/practice/assessment/snbt/fixture-domain/practice",
        items: [
          {
            href: "/material/practice/assessment/snbt/fixture-domain/practice/set-1",
            title: "Set 1",
          },
        ],
        title: "Latihan",
      },
    ]);
    expect(
      toPracticeMaterialList(practice, "en")[0]?.description
    ).toBeUndefined();
    expect(listPracticeMaterialSets([practice], "id")).toEqual([
      expect.not.objectContaining({ year: expect.any(Number) }),
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
      sections: [],
      slug: "exponents",
      translations: {
        en: { title: "Exponents" },
        id: { title: "Eksponen" },
      },
    });

    expect(Either.isLeft(result)).toBe(true);

    if (Either.isLeft(result)) {
      expect(ParseResult.TreeFormatter.formatErrorSync(result.left)).toContain(
        "Invalid material route."
      );
    }
  });

  it("rejects invalid authored material keys and slugs through the Effect Schema contract", () => {
    const invalidKey = Schema.decodeUnknownEither(LessonMaterialSourceSchema)({
      assetRoot: "material/lesson/mathematics/exponents",
      domain: "mathematics",
      kind: "lesson",
      key: "Lesson Mathematics",
      sections: [],
      slug: "exponents",
      translations: {
        en: { title: "Exponents" },
        id: { title: "Eksponen" },
      },
    });
    const invalidSlug = Schema.decodeUnknownEither(LessonMaterialSourceSchema)({
      assetRoot: "material/lesson/mathematics/exponents",
      domain: "mathematics",
      kind: "lesson",
      key: "lesson.mathematics.exponents",
      sections: [],
      slug: "Invalid Slug",
      translations: {
        en: { title: "Invalid" },
        id: { title: "Tidak Valid" },
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

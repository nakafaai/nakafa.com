import {
  findExerciseMaterial,
  findSubjectMaterial,
  getExerciseMaterialList,
  getSubjectMaterialList,
  listExerciseMaterials,
  listExerciseSets,
  listMaterials,
  listSubjectMaterials,
  listSubjectTopics,
} from "@repo/contents/_types/material/registry";
import {
  defineExerciseMaterial,
  defineSubjectMaterial,
  defineSubjectMaterialTopic,
  SubjectMaterialSourceSchema,
  SubjectMaterialTopicSchema,
} from "@repo/contents/_types/material/schema";
import { Either, ParseResult, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("material registry", () => {
  it("projects subject materials into localized navigation without route-local data files", () => {
    const idMaterials = getSubjectMaterialList(
      "subject/high-school/10/mathematics",
      "id"
    );
    const enMaterials = getSubjectMaterialList(
      "/subject/high-school/10/mathematics",
      "en"
    );

    expect(idMaterials[0]).toMatchObject({
      href: "/subject/high-school/10/mathematics/exponential-logarithm",
      title: "Eksponen dan Logaritma",
    });
    expect(enMaterials[0]).toMatchObject({
      href: "/subject/high-school/10/mathematics/exponential-logarithm",
      title: "Exponents and Logarithms",
    });
    expect(idMaterials[0]?.items[0]).toEqual({
      href: "/subject/high-school/10/mathematics/exponential-logarithm/basic-concept",
      title: "Konsep Eksponen",
    });
  });

  it("projects exercise materials into localized set navigation", () => {
    const materials = getExerciseMaterialList(
      "exercises/high-school/snbt/quantitative-knowledge",
      "en"
    );

    expect(materials).toHaveLength(1);
    expect(materials[0]).toMatchObject({
      href: "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
      title: "Try Out 2026",
    });
    expect(materials[0]?.items).toHaveLength(10);
    expect(materials[0]?.items[0]).toEqual({
      href: "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
      title: "Set 1",
    });
  });

  it("projects exercise groups without a year segment", () => {
    const materials = getExerciseMaterialList(
      "exercises/middle-school/grade-9/mathematics",
      "id"
    );

    expect(materials[0]).toMatchObject({
      href: "/exercises/middle-school/grade-9/mathematics/semester-1",
      title: "Semester 1",
    });
    expect(materials[0]?.items[0]).toEqual({
      href: "/exercises/middle-school/grade-9/mathematics/semester-1/set-1",
      title: "Set 1",
    });
  });

  it("projects sync-ready rows for both supported content languages", () => {
    const subjectTopics = listSubjectTopics();
    const exerciseSets = listExerciseSets();

    expect(subjectTopics.some((topic) => topic.locale === "id")).toBe(true);
    expect(subjectTopics.some((topic) => topic.locale === "en")).toBe(true);
    expect(
      exerciseSets.some(
        (set) =>
          set.locale === "en" &&
          set.slug ===
            "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1"
      )
    ).toBe(true);

    expect(
      listSubjectTopics("id").every((topic) => topic.locale === "id")
    ).toBe(true);
    expect(listExerciseSets("id").every((set) => set.locale === "id")).toBe(
      true
    );
  });

  it("keeps material keys and base routes unique", () => {
    const materials = listMaterials();
    const keys = new Set(materials.map((material) => material.key));
    const baseRoutes = new Set(materials.map((material) => material.baseRoute));

    expect(keys.size).toBe(materials.length);
    expect(baseRoutes.size).toBe(materials.length);
    expect(listSubjectMaterials()).not.toHaveLength(0);
    expect(listExerciseMaterials()).not.toHaveLength(0);
  });

  it("finds concrete materials by route without exposing the wrong material kind", () => {
    expect(
      findSubjectMaterial(
        "subject/high-school/10/mathematics/exponential-logarithm/basic-concept"
      )?.key
    ).toBe("subject.high-school.10.mathematics");
    expect(
      findExerciseMaterial(
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1"
      )?.key
    ).toBe("exercises.high-school.snbt.quantitative-knowledge");
    expect(findSubjectMaterial("exercises/high-school/snbt")).toBeNull();
    expect(
      findExerciseMaterial("subject/high-school/10/mathematics")
    ).toBeNull();
    expect(getSubjectMaterialList("subject/not-found", "id")).toEqual([]);
    expect(getExerciseMaterialList("exercises/not-found", "en")).toEqual([]);
  });

  it("projects custom typed source chunks without optional descriptions", () => {
    const topic = defineSubjectMaterialTopic({
      sections: [],
      slug: "custom-topic",
      translations: {
        en: { title: "Custom Topic" },
        id: { title: "Topik Khusus" },
      },
    });
    const material = defineSubjectMaterial({
      baseRoute: "subject/high-school/10/biology",
      category: "high-school",
      grade: "10",
      kind: "subject",
      key: "subject.high-school.10.biology.custom",
      material: "biology",
      topics: [topic],
    });
    const exercise = defineExerciseMaterial({
      baseRoute: "exercises/middle-school/grade-9/mathematics",
      category: "middle-school",
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
      kind: "exercise",
      key: "exercises.middle-school.grade-9.mathematics.custom",
      material: "mathematics",
      type: "grade-9",
    });

    expect(
      getSubjectMaterialList("subject/high-school/10/biology", "en", [material])
    ).toEqual([
      {
        href: "/subject/high-school/10/biology/custom-topic",
        items: [],
        title: "Custom Topic",
      },
    ]);
    expect(
      getExerciseMaterialList(
        "exercises/middle-school/grade-9/mathematics",
        "id",
        [exercise]
      )
    ).toEqual([
      {
        href: "/exercises/middle-school/grade-9/mathematics/practice",
        items: [
          {
            href: "/exercises/middle-school/grade-9/mathematics/practice/set-1",
            title: "Set 1",
          },
        ],
        title: "Latihan",
      },
    ]);
  });

  it("rejects invalid authored material routes through the Effect Schema contract", () => {
    const result = Schema.decodeUnknownEither(SubjectMaterialSourceSchema)({
      baseRoute: "/subject/high-school/10/mathematics",
      category: "high-school",
      grade: "10",
      kind: "subject",
      key: "subject.high-school.10.mathematics",
      material: "mathematics",
      topics: [],
    });

    expect(Either.isLeft(result)).toBe(true);

    if (Either.isLeft(result)) {
      expect(ParseResult.TreeFormatter.formatErrorSync(result.left)).toContain(
        "Invalid material route."
      );
    }
  });

  it("rejects invalid authored material keys and slugs through the Effect Schema contract", () => {
    const invalidKey = Schema.decodeUnknownEither(SubjectMaterialSourceSchema)({
      baseRoute: "subject/high-school/10/mathematics",
      category: "high-school",
      grade: "10",
      kind: "subject",
      key: "Subject High School",
      material: "mathematics",
      topics: [],
    });
    const invalidSlug = Schema.decodeUnknownEither(SubjectMaterialTopicSchema)({
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

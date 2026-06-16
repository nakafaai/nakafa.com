import { listCurriculumNodes } from "@repo/contents/_types/curriculum/projection";
import {
  listCurriculumCategoryParams,
  listCurriculumGradeParams,
  listCurriculumLessonParams,
  listCurriculumMaterialParams,
  listSchoolCurriculumPlacements,
} from "@repo/contents/_types/curriculum/routes";
import { defineCurriculum } from "@repo/contents/_types/curriculum/schema";
import { defineLessonMaterial } from "@repo/contents/_types/material/schema";
import { describe, expect, it } from "vitest";

const mappedMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/linear-functions",
  domain: "mathematics",
  key: "fixture.linear-functions",
  kind: "lesson",
  sections: [
    {
      slug: "slope",
      translations: {
        en: { title: "Slope" },
        id: { title: "Gradien" },
      },
    },
  ],
  slug: "linear-functions",
  translations: {
    en: { title: "Linear functions" },
    id: { title: "Fungsi linear" },
  },
});

const unmappedMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/physics/motion",
  domain: "physics",
  key: "fixture.motion",
  kind: "lesson",
  sections: [
    {
      slug: "speed",
      translations: {
        en: { title: "Speed" },
        id: { title: "Kelajuan" },
      },
    },
  ],
  slug: "motion",
  translations: {
    en: { title: "Motion" },
    id: { title: "Gerak" },
  },
});

const schoolCurriculum = defineCurriculum({
  programKey: "fixture-school",
  tree: [
    {
      key: "class-10",
      level: "class",
      order: 10,
      translations: {
        en: { title: "Class 10" },
        id: { title: "Kelas 10" },
      },
      children: [
        {
          key: "mathematics",
          level: "subject",
          order: 10,
          translations: {
            en: { title: "Mathematics" },
            id: { title: "Matematika" },
          },
          children: [
            {
              key: "linear-functions",
              level: "topic",
              materialKeys: ["fixture.linear-functions"],
              order: 10,
            },
          ],
        },
      ],
    },
  ],
});

const noClassCurriculum = defineCurriculum({
  programKey: "fixture-without-class",
  tree: [
    {
      key: "linear-functions",
      level: "topic",
      materialKeys: ["fixture.linear-functions"],
      order: 10,
    },
  ],
});

const unsupportedClassCurriculum = defineCurriculum({
  programKey: "fixture-middle-school",
  tree: [
    {
      key: "class-9",
      level: "class",
      order: 9,
      translations: {
        en: { title: "Class 9" },
        id: { title: "Kelas 9" },
      },
      children: [
        {
          key: "linear-functions",
          level: "topic",
          materialKeys: ["fixture.linear-functions"],
          order: 10,
        },
      ],
    },
  ],
});

describe("curriculum route params", () => {
  it("derives default route params from registered curriculum mappings", () => {
    expect(
      listCurriculumCategoryParams().some(
        (param) => param.category === "high-school"
      )
    ).toBe(true);
    expect(listCurriculumGradeParams().length).toBeGreaterThan(0);
    expect(listCurriculumMaterialParams().length).toBeGreaterThan(0);
    expect(listCurriculumLessonParams().length).toBeGreaterThan(0);
    expect(listSchoolCurriculumPlacements().length).toBeGreaterThan(0);
  });

  it("derives school curriculum route params from curriculum mappings", () => {
    const inputs = {
      curricula: [schoolCurriculum],
      materials: [mappedMaterial, unmappedMaterial],
    };

    expect(listCurriculumCategoryParams(inputs)).toEqual([
      { category: "high-school" },
    ]);
    expect(listCurriculumGradeParams(inputs)).toEqual([
      { category: "high-school", grade: "10" },
    ]);
    expect(listCurriculumMaterialParams(inputs)).toEqual([
      {
        category: "high-school",
        grade: "10",
        material: "mathematics",
      },
    ]);
    expect(listCurriculumLessonParams(inputs)).toEqual([
      {
        category: "high-school",
        grade: "10",
        material: "mathematics",
        slug: ["linear-functions", "slope"],
      },
    ]);
  });

  it("does not expose unmapped material routes as curriculum params", () => {
    expect(
      listSchoolCurriculumPlacements({
        curricula: [schoolCurriculum],
        materials: [mappedMaterial, unmappedMaterial],
      })
    ).toEqual([
      {
        category: "high-school",
        grade: "10",
        material: "mathematics",
        materialKey: "fixture.linear-functions",
        order: 10,
      },
    ]);
  });

  it("skips projected lesson params when the material projection is unavailable", () => {
    const curriculumNodes = listCurriculumNodes({
      curricula: [schoolCurriculum],
      materials: [mappedMaterial],
    });

    expect(
      listCurriculumLessonParams({
        curriculumNodes,
        materials: [],
      })
    ).toEqual([]);
  });

  it("skips curriculum nodes without a class ancestor", () => {
    expect(
      listSchoolCurriculumPlacements({
        curricula: [noClassCurriculum],
        materials: [mappedMaterial],
      })
    ).toEqual([]);
  });

  it("skips curriculum nodes outside the high-school grade route range", () => {
    expect(
      listSchoolCurriculumPlacements({
        curricula: [unsupportedClassCurriculum],
        materials: [mappedMaterial],
      })
    ).toEqual([]);
  });
});

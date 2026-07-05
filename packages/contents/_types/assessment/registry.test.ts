import {
  getAssessmentSourceIssues,
  listAssessments,
} from "@repo/contents/_types/assessment/registry";
import { defineAssessment } from "@repo/contents/_types/assessment/schema";
import { defineLessonMaterial } from "@repo/contents/_types/material/schema";
import { describe, expect, it } from "vitest";

const material = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/fixture-domain",
  domain: "mathematics",
  key: "lesson.mathematics.fixture-domain",
  kind: "lesson",
  routeSlugs: { en: "fixture-domain", id: "domain-fixture" },
  sections: [],
  slug: "fixture-domain",
  translations: {
    en: { description: "Read fixture mathematics.", title: "Fixture Domain" },
    id: { description: "Baca matematika fixture.", title: "Domain Fixture" },
  },
});

const assessment = defineAssessment({
  programKey: "snbt",
  nodes: [
    {
      key: "root",
      level: "section",
      materialKeys: [],
      order: 1,
      translations: {
        en: { routeSlug: "root", title: "Root" },
        id: { routeSlug: "root", title: "Root" },
      },
    },
    {
      key: "domain",
      level: "domain",
      materialKeys: ["lesson.mathematics.fixture-domain"],
      order: 1,
      parentKey: "root",
      translations: {
        en: { routeSlug: "domain", title: "Domain" },
        id: { routeSlug: "domain", title: "Domain" },
      },
    },
  ],
});

describe("assessment registry", () => {
  it("lists authored assessment structures through the default source", () => {
    expect(listAssessments().length).toBeGreaterThan(0);
    expect(getAssessmentSourceIssues()).toEqual([]);
  });

  it("accepts assessment mappings that point at authored lesson materials", () => {
    expect(
      getAssessmentSourceIssues({
        assessments: [assessment],
        materials: [material],
      })
    ).toEqual([]);
  });

  it("reports missing assessment parent and material references", () => {
    const brokenAssessment = defineAssessment({
      programKey: "snbt",
      nodes: [
        {
          key: "domain",
          level: "domain",
          materialKeys: ["lesson.mathematics.missing"],
          order: 1,
          parentKey: "missing-parent",
          translations: {
            en: { routeSlug: "domain", title: "Domain" },
            id: { routeSlug: "domain", title: "Domain" },
          },
        },
      ],
    });

    expect(
      getAssessmentSourceIssues({
        assessments: [brokenAssessment],
        materials: [material],
      })
    ).toEqual([
      "Unknown parent node missing-parent in snbt:domain",
      "Unknown material key lesson.mathematics.missing in snbt:domain",
    ]);
  });
});

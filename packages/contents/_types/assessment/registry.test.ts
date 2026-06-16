import {
  getAssessmentSourceIssues,
  listAssessments,
} from "@repo/contents/_types/assessment/registry";
import { defineAssessment } from "@repo/contents/_types/assessment/schema";
import { definePracticeMaterial } from "@repo/contents/_types/material/schema";
import { describe, expect, it } from "vitest";

const material = definePracticeMaterial({
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
  key: "practice.assessment.snbt.fixture-domain",
  kind: "practice",
});

const assessment = defineAssessment({
  programKey: "snbt-2026",
  nodes: [
    {
      key: "root",
      level: "section",
      materialKeys: [],
      order: 1,
      translations: {
        en: { title: "Root" },
        id: { title: "Root" },
      },
    },
    {
      key: "domain",
      level: "domain",
      materialKeys: ["practice.assessment.snbt.fixture-domain"],
      order: 1,
      parentKey: "root",
      translations: {
        en: { title: "Domain" },
        id: { title: "Domain" },
      },
    },
  ],
});

describe("assessment registry", () => {
  it("lists authored assessment structures through the default source", () => {
    expect(listAssessments().length).toBeGreaterThan(0);
    expect(getAssessmentSourceIssues()).toEqual([]);
  });

  it("accepts assessment mappings that point at authored practice materials", () => {
    expect(
      getAssessmentSourceIssues({
        assessments: [assessment],
        materials: [material],
      })
    ).toEqual([]);
  });

  it("reports missing assessment parent and material references", () => {
    const brokenAssessment = defineAssessment({
      programKey: "snbt-2026",
      nodes: [
        {
          key: "domain",
          level: "domain",
          materialKeys: ["practice.assessment.snbt.missing"],
          order: 1,
          parentKey: "missing-parent",
          translations: {
            en: { title: "Domain" },
            id: { title: "Domain" },
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
      "Unknown parent node missing-parent in snbt-2026:domain",
      "Unknown material key practice.assessment.snbt.missing in snbt-2026:domain",
    ]);
  });
});

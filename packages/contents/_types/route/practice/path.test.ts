import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { definePracticeMaterial } from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import {
  isPracticeSetRoute,
  listPublicContentRoutes,
} from "@repo/contents/_types/route/content";
import {
  getPracticeSourceGroupSlug,
  isPracticeQuestionPath,
  readPracticeSourceGroupIdentity,
  readPublicPracticeAssessmentPath,
  readPublicPracticeDomainPath,
  readPublicPracticePathParts,
  readPublicPracticeQuestionNumber,
  readSourcePracticePathParts,
  readSourcePracticeQuestionNumber,
  readSourcePracticeRoutePath,
  toPublicPracticeGroupSegment,
  toPublicPracticeQuestionSegment,
} from "@repo/contents/_types/route/practice/path";
import { readPublicPracticeQuestionRouteBySourcePath } from "@repo/contents/_types/route/practice/question";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("practice route path grammar", () => {
  const noYearPracticeMaterial = definePracticeMaterial({
    assessment: "snbt",
    assetRoot: "material/practice/assessment/snbt/quantitative-knowledge",
    domain: "quantitative-knowledge",
    groups: [
      {
        exerciseType: "drill",
        routeSlugs: { en: "drill", id: "latihan" },
        sets: [
          {
            routeSlugs: { en: "set-1", id: "set-1" },
            slug: "set-1",
            translations: {
              en: { title: "Set 1" },
              id: { title: "Set 1" },
            },
          },
        ],
        translations: {
          en: {
            description: "Targeted practice.",
            title: "Drill",
          },
          id: {
            description: "Latihan terarah.",
            title: "Latihan",
          },
        },
      },
    ],
    key: "snbt.quantitative-knowledge.drill",
    kind: "practice",
  });

  function readPracticeMaterialFixture() {
    const material = MATERIAL_SOURCES.find(
      (source) =>
        source.kind === "practice" &&
        source.assessment === "snbt" &&
        source.domain === "quantitative-knowledge"
    );

    if (material?.kind !== "practice") {
      expect.fail("Expected SNBT quantitative knowledge practice material.");
    }

    return material;
  }

  it("parses localized and source question segments strictly", () => {
    expect(
      readPublicPracticeQuestionNumber({
        locale: "en",
        segment: "question-9",
      })
    ).toBe(9);
    expect(
      readPublicPracticeQuestionNumber({
        locale: "id",
        segment: "soal-9",
      })
    ).toBe(9);

    const invalidSegments = [
      { locale: "en", segment: "soal-9" },
      { locale: "id", segment: "question-9" },
      { locale: "en", segment: "question-0" },
      { locale: "id", segment: "soal-01" },
      { locale: "en", segment: "question-one" },
      { locale: "id", segment: undefined },
    ] as const;

    for (const input of invalidSegments) {
      expect(readPublicPracticeQuestionNumber(input)).toBeNull();
    }

    expect(readSourcePracticeQuestionNumber("9")).toBe(9);
    expect(readSourcePracticeQuestionNumber("question-9")).toBe(9);

    for (const segment of ["0", "09", "soal-9", "question-x", undefined]) {
      expect(readSourcePracticeQuestionNumber(segment)).toBeNull();
    }
  });

  it("builds and recognizes practice path segments through the route grammar", () => {
    const practiceMaterial = readPracticeMaterialFixture();
    const practiceGroup = practiceMaterial.groups.find(
      (group) => group.exerciseType === "try-out" && group.year === 2026
    );
    const drillGroup = noYearPracticeMaterial.groups.at(0);

    if (!(practiceGroup && drillGroup)) {
      expect.fail("Expected year and no-year practice group fixtures.");
    }

    expect(toPublicPracticeGroupSegment(practiceGroup, "id")).toBe(
      "tryout-2026"
    );
    expect(toPublicPracticeGroupSegment(drillGroup, "en")).toBe("drill");
    expect(getPracticeSourceGroupSlug(practiceGroup)).toBe("try-out-2026");
    expect(getPracticeSourceGroupSlug(drillGroup)).toBe("drill");
    expect(readPracticeSourceGroupIdentity("try-out-2026")).toEqual({
      exerciseType: "try-out",
      year: "2026",
    });
    expect(readPracticeSourceGroupIdentity("drill")).toEqual({
      exerciseType: "drill",
    });
    expect(readPracticeSourceGroupIdentity("review-alpha")).toEqual({
      exerciseType: "review-alpha",
    });
    expect(toPublicPracticeQuestionSegment({ locale: "id", number: 9 })).toBe(
      "soal-9"
    );
    expect(toPublicPracticeQuestionSegment({ locale: "en", number: 9 })).toBe(
      "question-9"
    );

    expect(
      isPracticeQuestionPath(
        "practice/snbt/quantitative-knowledge/tryout-2026/set-1/question-9"
      )
    ).toBe(true);
    expect(
      isPracticeQuestionPath(
        "latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1/soal-9"
      )
    ).toBe(true);
    expect(
      isPracticeQuestionPath(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9"
      )
    ).toBe(true);
    expect(
      isPracticeQuestionPath(
        "practice/snbt/quantitative-knowledge/tryout-2026/set-1"
      )
    ).toBe(false);
  });

  it("reads named public/source practice path parts", () => {
    expect(
      readPublicPracticePathParts(
        "latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1/soal-9"
      )
    ).toEqual({
      assessment: "snbt",
      domain: "pengetahuan-kuantitatif",
      group: "tryout-2026",
      namespace: "latihan",
      question: "soal-9",
      set: "set-1",
    });
    expect(readPublicPracticePathParts("latihan/snbt")).toBeUndefined();
    expect(
      readPublicPracticePathParts(
        "latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1/soal-9/extra"
      )
    ).toBeUndefined();

    expect(
      readSourcePracticePathParts({
        assetRoot: "material/practice/assessment/snbt/quantitative-knowledge",
        sourcePath:
          "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9",
      })
    ).toEqual({ group: "try-out-2026", question: "9", set: "set-1" });
    expect(
      readSourcePracticePathParts({
        assetRoot: "material/practice/assessment/snbt/quantitative-knowledge",
        sourcePath:
          "material/practice/assessment/snbt/general-knowledge/try-out-2026/set-1/9",
      })
    ).toBeUndefined();
    expect(
      readSourcePracticePathParts({
        assetRoot: "material/practice/assessment/snbt/quantitative-knowledge",
        sourcePath:
          "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026",
      })
    ).toBeUndefined();
    expect(
      readSourcePracticePathParts({
        assetRoot: "material/practice/assessment/snbt/quantitative-knowledge",
        sourcePath:
          "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9/extra",
      })
    ).toBeUndefined();
  });

  it("canonicalizes source-folder question leaves to persisted numeric routes", () => {
    expect(
      readSourcePracticeRoutePath(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/question-9"
      )
    ).toEqual({
      kind: "question",
      sourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9",
    });
    expect(
      readSourcePracticeRoutePath(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1"
      )
    ).toEqual({
      kind: "set",
      sourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
    });
    expect(
      readSourcePracticeRoutePath(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/question-09"
      )
    ).toBeUndefined();
  });

  it("reads assessment and domain paths from concrete practice rows", () => {
    const routes = Effect.runSync(listPublicContentRoutes());
    const setRoute = routes
      .filter(isPracticeSetRoute)
      .find(
        (route) =>
          route.publicPath ===
          "practice/snbt/quantitative-knowledge/tryout-2026/set-1"
      );
    const projectedQuestionRoute = readPublicPracticeQuestionRouteBySourcePath({
      domains: MATERIAL_ROUTE_DOMAINS,
      locale: "en",
      materials: MATERIAL_SOURCES,
      sourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9",
    });

    if (!(setRoute && projectedQuestionRoute)) {
      expect.fail("Expected projected set and question route fixtures.");
    }

    expect(readPublicPracticeAssessmentPath(setRoute)).toBe("practice/snbt");
    expect(readPublicPracticeDomainPath(setRoute)).toBe(
      "practice/snbt/quantitative-knowledge"
    );
    expect(readPublicPracticeAssessmentPath(projectedQuestionRoute)).toBe(
      "practice/snbt"
    );
    expect(readPublicPracticeDomainPath(projectedQuestionRoute)).toBe(
      "practice/snbt/quantitative-knowledge"
    );
  });
});

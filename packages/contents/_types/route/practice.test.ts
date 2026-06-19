import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { definePracticeMaterial } from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import {
  findPublicContentRouteByPath,
  findPublicContentRouteBySourcePath,
  listPublicContentRoutes,
} from "@repo/contents/_types/route/content";
import {
  readPublicPracticeQuestionNumber,
  readPublicPracticeQuestionRouteBySourcePath,
  readSourcePracticeQuestionNumber,
  toPublicExerciseQuestionPath,
} from "@repo/contents/_types/route/practice";
import { findPublicRouteByPath } from "@repo/contents/_types/route/projection";
import { Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("public practice routes", () => {
  it("parses localized public question segments through one route grammar", () => {
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
  });

  it("parses source practice question leaves through one route grammar", () => {
    expect(readSourcePracticeQuestionNumber("9")).toBe(9);
    expect(readSourcePracticeQuestionNumber("question-9")).toBe(9);

    for (const segment of ["0", "09", "soal-9", "question-x", undefined]) {
      expect(readSourcePracticeQuestionNumber(segment)).toBeNull();
    }
  });

  it("derives canonical exercise set and localized question routes", () => {
    expect(Effect.runSync(listPublicContentRoutes())).toContainEqual(
      expect.objectContaining({
        kind: "exercise-set",
        locale: "id",
        publicPath: "latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1",
        sourcePath:
          "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
      })
    );
    expect(
      Effect.runSync(
        toPublicExerciseQuestionPath({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          exerciseType: "try-out",
          locale: "id",
          number: 9,
          setName: "set-1",
          year: 2026,
        })
      )
    ).toBe("latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/soal-9");
    expect(
      Effect.runSync(
        toPublicExerciseQuestionPath({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          exerciseType: "try-out",
          locale: "en",
          number: 9,
          setName: "set-1",
          year: 2026,
        })
      )
    ).toBe(
      "practice/snbt/quantitative-knowledge/mock-test/2026/set-1/question-9"
    );
  });

  it("finds exercise questions by localized public path and source path", () => {
    expect(
      Option.getOrNull(
        Effect.runSync(
          findPublicRouteByPath(
            "practice/snbt/quantitative-knowledge/mock-test/2026/set-1/question-9",
            "en"
          )
        )
      )
    ).toMatchObject({
      kind: "exercise-question",
      publicPath:
        "practice/snbt/quantitative-knowledge/mock-test/2026/set-1/question-9",
      sourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9",
    });
    expect(
      Option.getOrNull(
        Effect.runSync(
          findPublicContentRouteByPath(
            "latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/soal-9",
            "id"
          )
        )
      )
    ).toMatchObject({
      kind: "exercise-question",
      sourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9",
    });
    expect(
      Option.getOrNull(
        Effect.runSync(
          findPublicContentRouteBySourcePath(
            "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9",
            "en"
          )
        )
      )
    ).toMatchObject({
      publicPath:
        "practice/snbt/quantitative-knowledge/mock-test/2026/set-1/question-9",
    });
    expect(
      Option.getOrNull(
        Effect.runSync(
          findPublicContentRouteBySourcePath(
            "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9",
            "id"
          )
        )
      )
    ).toMatchObject({
      publicPath:
        "latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/soal-9",
      title: "Set 1 Soal 9",
    });
  });

  it("rejects invalid localized exercise paths and source paths", () => {
    const invalidPaths = [
      "latihan/snbt/pengetahuan-kuantitatif/review/2026/set-1/soal-1",
      "latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/question-1",
      "latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/soal-0",
      "latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/soal-01",
    ];

    for (const path of invalidPaths) {
      expect(
        Option.isNone(Effect.runSync(findPublicRouteByPath(path, "id")))
      ).toBe(true);
    }
    expect(
      Option.isNone(
        Effect.runSync(
          findPublicContentRouteBySourcePath(
            "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/0",
            "en"
          )
        )
      )
    ).toBe(true);
    expect(
      readPublicPracticeQuestionRouteBySourcePath({
        domains: MATERIAL_ROUTE_DOMAINS.filter(
          (domain) =>
            !(
              domain.kind === "practice" &&
              domain.domain === "quantitative-knowledge"
            )
        ),
        locale: "en",
        materials: MATERIAL_SOURCES,
        sourcePath:
          "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9",
      })
    ).toBeUndefined();
    expect(
      readPublicPracticeQuestionRouteBySourcePath({
        domains: MATERIAL_ROUTE_DOMAINS,
        locale: "en",
        materials: MATERIAL_SOURCES,
        sourcePath:
          "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
      })
    ).toBeUndefined();
    expect(
      readPublicPracticeQuestionRouteBySourcePath({
        domains: MATERIAL_ROUTE_DOMAINS,
        locale: "en",
        materials: MATERIAL_SOURCES,
        sourcePath:
          "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/not-a-question",
      })
    ).toBeUndefined();
  });

  it("derives question routes for practice groups that do not have a year", () => {
    const practiceWithoutYear = definePracticeMaterial({
      assessment: "snbt",
      assetRoot: "material/practice/assessment/snbt/mathematics/drill",
      domain: "mathematics",
      groups: [
        {
          exerciseType: "drill",
          routeSlugs: { en: "drill", id: "latihan" },
          sets: [
            {
              routeSlugs: { en: "set-a", id: "set-a" },
              slug: "set-a",
              translations: {
                en: { title: "Set A" },
                id: { title: "Set A" },
              },
            },
          ],
          translations: {
            en: { description: "Focused drill.", title: "Drill" },
            id: { description: "Latihan fokus.", title: "Latihan" },
          },
        },
      ],
      key: "practice.fixture.snbt.no-year",
      kind: "practice",
    });

    expect(
      Effect.runSync(
        toPublicExerciseQuestionPath({
          assessment: "snbt",
          domain: "mathematics",
          exerciseType: "drill",
          locale: "id",
          materials: [practiceWithoutYear],
          number: 2,
          setName: "set-a",
        })
      )
    ).toBe("latihan/snbt/matematika/latihan/set-a/soal-2");
    expect(
      Option.isNone(
        Effect.runSync(
          findPublicContentRouteBySourcePath(
            "material/practice/assessment/snbt/mathematics/drill/set-a/0",
            "en",
            { materials: [practiceWithoutYear] }
          )
        )
      )
    ).toBe(true);
    expect(
      Option.isNone(
        Effect.runSync(
          findPublicContentRouteBySourcePath(
            "material/practice/assessment/snbt/mathematics/other/set-a/question-1",
            "en",
            { materials: [practiceWithoutYear] }
          )
        )
      )
    ).toBe(true);
  });

  it("fails with typed errors for invalid or incomplete practice route input", () => {
    const invalidInput = JSON.parse(
      JSON.stringify({
        assessment: "snbt",
        domain: "quantitative-knowledge",
        exerciseType: "try-out",
        locale: "fr",
        number: 1,
        setName: "set-1",
        year: 2026,
      })
    );
    const missingMaterial = toPublicExerciseQuestionPath({
      assessment: "snbt",
      domain: "quantitative-knowledge",
      exerciseType: "try-out",
      locale: "id",
      materials: [],
      number: 1,
      setName: "set-1",
      year: 2026,
    });
    const missingActivity = toPublicExerciseQuestionPath({
      assessment: "snbt",
      domain: "quantitative-knowledge",
      exerciseType: "drill",
      locale: "id",
      number: 1,
      setName: "set-1",
      year: 2026,
    });
    const missingDomain = toPublicExerciseQuestionPath({
      assessment: "snbt",
      domain: "quantitative-knowledge",
      domains: [],
      exerciseType: "try-out",
      locale: "id",
      number: 1,
      setName: "set-1",
      year: 2026,
    });

    expect(
      Exit.isFailure(
        Effect.runSyncExit(toPublicExerciseQuestionPath(invalidInput))
      )
    ).toBe(true);
    expect(Exit.isFailure(Effect.runSyncExit(missingMaterial))).toBe(true);
    expect(Exit.isFailure(Effect.runSyncExit(missingActivity))).toBe(true);
    expect(Exit.isFailure(Effect.runSyncExit(missingDomain))).toBe(true);
  });
});

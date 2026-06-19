import {
  readPracticeQuestionSourceParts,
  readPracticeSourceRouteByPath,
  readPracticeSourceSetParts,
} from "@repo/contents/_types/route/practice/identity";
import { describe, expect, it } from "vitest";

describe("practice source route identity", () => {
  it("resolves public and source practice paths to canonical source routes", () => {
    expect(
      readPracticeSourceRouteByPath({
        locale: "id",
        route: "latihan/snbt/pengetahuan-umum/tryout-2026/set-1/soal-9",
      })
    ).toEqual({
      kind: "question",
      sourcePath:
        "material/practice/assessment/snbt/general-knowledge/try-out-2026/set-1/9",
    });
    expect(
      readPracticeSourceRouteByPath({
        locale: "en",
        route: "practice/snbt/general-knowledge/tryout-2026/set-1",
      })
    ).toEqual({
      kind: "set",
      sourcePath:
        "material/practice/assessment/snbt/general-knowledge/try-out-2026/set-1",
    });
    expect(
      readPracticeSourceRouteByPath({
        locale: "id",
        route:
          "material/practice/assessment/snbt/general-knowledge/try-out-2026/set-1/9",
      })
    ).toEqual({
      kind: "question",
      sourcePath:
        "material/practice/assessment/snbt/general-knowledge/try-out-2026/set-1/9",
    });
    expect(
      readPracticeSourceRouteByPath({
        locale: "id",
        route:
          "material/practice/assessment/snbt/general-knowledge/try-out-2026/set-1",
      })
    ).toEqual({
      kind: "set",
      sourcePath:
        "material/practice/assessment/snbt/general-knowledge/try-out-2026/set-1",
    });
  });

  it("rejects unsupported public and non-practice routes", () => {
    const invalidRoutes = [
      "latihan/snbt/pengetahuan-umum/tryout-2026/set-1/soal-9/extra",
      "latihan/snbt/pengetahuan-umum/drill-2026/set-1",
      "material/practice/assessment/snbt/general-knowledge/try-out-2026/set-1/question-09",
      "materi/matematika/fungsi",
    ];

    for (const route of invalidRoutes) {
      expect(
        readPracticeSourceRouteByPath({
          locale: "id",
          route,
        })
      ).toBeUndefined();
    }
  });

  it("reads canonical source set and question metadata for runtime callers", () => {
    expect(
      readPracticeSourceSetParts(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1"
      )
    ).toEqual({
      category: "high-school",
      exerciseType: "try-out",
      material: "quantitative-knowledge",
      type: "snbt",
      year: "2026",
    });
    expect(
      readPracticeQuestionSourceParts(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9"
      )
    ).toEqual({
      questionNumber: 9,
      setSourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
    });
    expect(
      readPracticeSourceSetParts(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out/2026/set-1"
      )
    ).toBeUndefined();
    expect(
      readPracticeSourceSetParts(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026"
      )
    ).toBeUndefined();
    expect(
      readPracticeSourceSetParts(
        "material/practice/assessment/unknown/quantitative-knowledge/try-out-2026/set-1"
      )
    ).toBeUndefined();
    expect(
      readPracticeSourceSetParts("material/lesson/mathematics/function")
    ).toBeUndefined();
    expect(readPracticeSourceSetParts("not-a-practice-route")).toBeUndefined();
    expect(
      readPracticeQuestionSourceParts(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/question-09"
      )
    ).toBeUndefined();
  });
});

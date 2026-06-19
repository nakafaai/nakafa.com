// @vitest-environment node

import { findPublicContentRouteBySourcePath } from "@repo/contents/_types/route/content";
import { PublicRoutePathSchema } from "@repo/contents/_types/route/segment";
import { Effect, Option, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPracticeRouteAlternates,
  readPracticeRoutes,
  toPracticeHref,
} from "./routes";
import {
  localizeQuestionPaginationItem,
  readExerciseSetSourceParts,
  readGroupTitle,
  readQuestionSourcePathParts,
} from "./source";

const runtimeMocks = vi.hoisted(() => ({
  fetchRuntimeExerciseQuestionPage: vi.fn(),
  fetchRuntimeExerciseSetPage: vi.fn(),
}));

vi.mock("@/lib/content/runtime/pages", () => ({
  fetchRuntimeExerciseQuestionPage:
    runtimeMocks.fetchRuntimeExerciseQuestionPage,
  fetchRuntimeExerciseSetPage: runtimeMocks.fetchRuntimeExerciseSetPage,
}));

describe("practice route data", () => {
  beforeEach(() => {
    runtimeMocks.fetchRuntimeExerciseQuestionPage.mockReset();
    runtimeMocks.fetchRuntimeExerciseSetPage.mockReset();
    runtimeMocks.fetchRuntimeExerciseQuestionPage.mockResolvedValue({
      exercise: { id: "question-9" },
      exerciseCount: 10,
    });
    runtimeMocks.fetchRuntimeExerciseSetPage.mockResolvedValue({
      exercises: [{ id: "question-1" }],
    });
  });

  it("derives group and question alternates from projected practice route rows", async () => {
    const { getPracticeRouteData } = await importPracticeData();
    const group = await getPracticeRouteData(
      Promise.resolve({
        assessment: "snbt",
        domain: "quantitative-knowledge",
        locale: "en",
        path: ["mock-test", "2026"],
      })
    );

    expect(group.kind).toBe("year-group");

    if (group.kind !== "year-group") {
      return;
    }

    expect(group.publicPath).toBe(
      "practice/snbt/quantitative-knowledge/mock-test/2026"
    );
    expect(group.group.alternatePaths).toEqual(
      expect.arrayContaining([
        {
          locale: "en",
          publicPath: "practice/snbt/quantitative-knowledge/mock-test/2026",
        },
        {
          locale: "id",
          publicPath: "latihan/snbt/pengetahuan-kuantitatif/tryout/2026",
        },
      ])
    );

    const question = Effect.runSync(
      findPublicContentRouteBySourcePath(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9",
        "en"
      )
    );

    expect(Option.isSome(question)).toBe(true);

    if (Option.isNone(question)) {
      return;
    }

    expect(question.value.kind).toBe("exercise-question");

    if (question.value.kind !== "exercise-question") {
      return;
    }

    const questionAlternates = readPracticeRouteAlternates(
      question.value,
      readPracticeRoutes()
    );

    expect(
      questionAlternates.map((route) => ({
        locale: route.locale,
        publicPath: route.publicPath,
      }))
    ).toEqual(
      expect.arrayContaining([
        {
          locale: "en",
          publicPath:
            "practice/snbt/quantitative-knowledge/mock-test/2026/set-1/question-9",
        },
        {
          locale: "id",
          publicPath:
            "latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/soal-9",
        },
      ])
    );
  });

  it("resolves set, question, static param, runtime slug, and pagination data", async () => {
    const {
      getPracticeQuestionPagination,
      getPracticeRouteData,
      getPracticeRuntimeSetPath,
      listPracticeStaticParams,
    } = await importPracticeData();
    const params = Promise.resolve({
      assessment: "snbt",
      domain: "quantitative-knowledge",
      locale: "en",
      path: ["mock-test", "2026", "set-1"],
    });
    const set = await getPracticeRouteData(params);

    expect(set.kind).toBe("set");

    if (set.kind !== "set") {
      return;
    }

    expect(set.pagePath).toBe(
      "/en/practice/snbt/quantitative-knowledge/mock-test/2026/set-1"
    );
    expect(set.group.material.items.length).toBeGreaterThan(0);
    expect(toPracticeHref(set.route)).toBe(set.pagePath);
    const setAlternates = readPracticeRouteAlternates(
      set.route,
      readPracticeRoutes()
    );

    expect(
      setAlternates.map((route) => ({
        locale: route.locale,
        publicPath: route.publicPath,
      }))
    ).toEqual([
      {
        locale: "en",
        publicPath: "practice/snbt/quantitative-knowledge/mock-test/2026/set-1",
      },
      {
        locale: "id",
        publicPath: "latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1",
      },
    ]);
    expect(
      readPracticeRouteAlternates(
        {
          ...set.route,
          sourcePath: Effect.runSync(
            Schema.decodeUnknown(PublicRoutePathSchema)(
              "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/missing-set"
            )
          ),
        },
        readPracticeRoutes()
      )
    ).toEqual([]);
    await expect(getPracticeRuntimeSetPath(params)).resolves.toMatchObject({
      routePath: "practice/snbt/quantitative-knowledge/mock-test/2026/set-1",
      setPath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
    });
    expect(listPracticeStaticParams()).toEqual(
      expect.arrayContaining([
        {
          assessment: "snbt",
          domain: "quantitative-knowledge",
          path: ["mock-test", "2026", "set-1"],
        },
      ])
    );

    const singleParams = Promise.resolve({
      assessment: "snbt",
      domain: "quantitative-knowledge",
      locale: "en",
      path: ["mock-test", "2026", "set-1", "question-9"],
    });
    const single = await getPracticeRouteData(singleParams);

    expect(single.kind).toBe("single");

    if (single.kind !== "single") {
      return;
    }

    expect(single.exerciseCount).toBe(10);
    expect(single.exerciseFilePath).toBe(
      "/en/practice/snbt/quantitative-knowledge/mock-test/2026/set-1/question-9"
    );
    await expect(
      getPracticeRuntimeSetPath(singleParams)
    ).resolves.toMatchObject({
      routePath:
        "practice/snbt/quantitative-knowledge/mock-test/2026/set-1/question-9",
      setPath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
    });
    await expect(
      getPracticeRuntimeSetPath(
        Promise.resolve({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          locale: "en",
          path: ["mock-test", "2026"],
        })
      )
    ).resolves.toMatchObject({
      routePath: "practice/snbt/quantitative-knowledge/mock-test/2026",
    });

    expect(
      getPracticeQuestionPagination({
        publicSetPath:
          "/id/latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1",
        questionNumber: 2,
        titleFormatter: (number) => `Question ${number}`,
        totalExercises: 3,
      })
    ).toMatchObject({
      next: {
        href: "/id/latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/soal-3",
      },
      prev: {
        href: "/id/latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/soal-1",
      },
    });
  });

  it("rejects practice group and question params that are not in the route projection", async () => {
    const { getPracticeRouteData } = await importPracticeData();

    await expect(
      getPracticeRouteData(
        Promise.resolve({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          locale: "en",
        })
      )
    ).rejects.toThrow();
    await expect(
      getPracticeRouteData(
        Promise.resolve({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          locale: "en",
          path: ["mock-test", "2027"],
        })
      )
    ).rejects.toThrow();
    await expect(
      getPracticeRouteData(
        Promise.resolve({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          locale: "en",
          path: ["mock-test", "2027", "set-1", "question-1"],
        })
      )
    ).rejects.toThrow();
    await expect(
      getPracticeRouteData(
        Promise.resolve({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          locale: "en",
          path: ["mock-test", "2026", "set-1", "question-0"],
        })
      )
    ).rejects.toThrow();
  });

  it("rejects valid practice routes when runtime read-model rows are missing", async () => {
    const { getPracticeRouteData } = await importPracticeData();

    runtimeMocks.fetchRuntimeExerciseSetPage.mockResolvedValueOnce(null);

    await expect(
      getPracticeRouteData(
        Promise.resolve({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          locale: "en",
          path: ["mock-test", "2026", "set-1"],
        })
      )
    ).rejects.toThrow();

    runtimeMocks.fetchRuntimeExerciseQuestionPage.mockResolvedValueOnce(null);

    await expect(
      getPracticeRouteData(
        Promise.resolve({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          locale: "en",
          path: ["mock-test", "2026", "set-1", "question-9"],
        })
      )
    ).rejects.toThrow();
  });

  it("keeps source-path parsing and pagination labels route-owned", () => {
    expect(
      readGroupTitle({
        sourcePath:
          "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
      })
    ).toBe("Try Out 2026");
    expect(
      readGroupTitle({
        sourcePath:
          "material/practice/assessment/snbt/quantitative-knowledge/drill/set-1",
      })
    ).toBe("drill");
    expect(
      readQuestionSourcePathParts(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9"
      )
    ).toEqual({
      questionNumber: 9,
      setSourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
    });
    expect(
      readExerciseSetSourceParts(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1"
      )
    ).toEqual({
      exerciseType: "try-out",
      material: "quantitative-knowledge",
      type: "snbt",
      year: "2026",
    });
    expect(
      localizeQuestionPaginationItem({ href: "", title: "Previous" })
    ).toEqual({ href: "", title: "Previous" });
    expect(
      localizeQuestionPaginationItem({ href: "/", title: "Next" })
    ).toEqual({ href: "/", title: "Next" });
    expect(
      localizeQuestionPaginationItem({
        href: "/en/practice/snbt/quantitative-knowledge/mock-test/2026/set-1/question",
        title: "Question",
      })
    ).toEqual({
      href: "/en/practice/snbt/quantitative-knowledge/mock-test/2026/set-1/question",
      title: "Question",
    });
    expect(
      localizeQuestionPaginationItem({
        href: "/en/practice/snbt/quantitative-knowledge/mock-test/2026/set-1/2",
        title: "Question 2",
      })
    ).toEqual({
      href: "/en/practice/snbt/quantitative-knowledge/mock-test/2026/set-1/question-2",
      title: "Question 2",
    });
    expect(() => readQuestionSourcePathParts("question-x")).toThrow();
    expect(() => readQuestionSourcePathParts("")).toThrow();
    expect(() => readExerciseSetSourceParts("material/practice")).toThrow();
    expect(() =>
      readExerciseSetSourceParts(
        "material/practice/assessment/unknown/quantitative-knowledge/try-out-2026/set-1"
      )
    ).toThrow();
  });
});

/** Imports the route-data module after Vitest has installed runtime mocks. */
async function importPracticeData() {
  return await import("./data");
}

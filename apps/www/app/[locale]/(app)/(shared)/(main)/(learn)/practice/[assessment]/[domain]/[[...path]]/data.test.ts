// @vitest-environment node

import { AbsoluteIcon } from "@hugeicons/core-free-icons";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import { findPublicContentRouteBySourcePath } from "@repo/contents/_types/route/content";
import { PublicRoutePathSchema } from "@repo/contents/_types/route/segment";
import { Effect, Option, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPracticeRouteAlternates,
  readPracticeRoutes,
  toPracticeHref,
} from "./routes";

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

  it("derives domain and question alternates from projected practice route rows", async () => {
    const { getPracticeRouteData } = await importPracticeData();
    const domain = await getPracticeRouteData(
      Promise.resolve({
        assessment: "snbt",
        domain: "quantitative-knowledge",
        locale: "en",
      })
    );

    expect(domain.kind).toBe("domain");

    if (domain.kind !== "domain") {
      return;
    }

    expect(domain.publicPath).toBe("practice/snbt/quantitative-knowledge");
    expect(domain.assessmentPath).toBe("/en/practice/snbt");
    expect(domain.pagePath).toBe("/en/practice/snbt/quantitative-knowledge");
    expect(domain.sourceMaterial).toBe("quantitative-knowledge");
    expect(getMaterialIcon(domain.sourceMaterial)).toBe(AbsoluteIcon);
    expect(domain.groups[0]?.material).toMatchObject({
      title: "Try Out 2026",
      items: expect.arrayContaining([
        expect.objectContaining({
          href: "/en/practice/snbt/quantitative-knowledge/tryout-2026/set-1",
          title: "Set 1",
        }),
      ]),
    });
    expect(domain.alternatePaths).toEqual(
      expect.arrayContaining([
        {
          locale: "en",
          publicPath: "practice/snbt/quantitative-knowledge",
        },
        {
          locale: "id",
          publicPath: "latihan/snbt/pengetahuan-kuantitatif",
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
            "practice/snbt/quantitative-knowledge/tryout-2026/set-1/question-9",
        },
        {
          locale: "id",
          publicPath:
            "latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1/soal-9",
        },
      ])
    );
  });

  it("resolves metadata from projected rows without runtime page reads", async () => {
    const { getPracticeMetadataData } = await importPracticeData();

    await expect(
      getPracticeMetadataData(
        Promise.resolve({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          locale: "en",
          path: ["tryout-2026", "set-1"],
        })
      )
    ).resolves.toMatchObject({
      kind: "route",
      route: {
        kind: "exercise-set",
        publicPath: "practice/snbt/quantitative-knowledge/tryout-2026/set-1",
      },
    });
    await expect(
      getPracticeMetadataData(
        Promise.resolve({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          locale: "en",
          path: ["tryout-2026", "set-1", "question-9"],
        })
      )
    ).resolves.toMatchObject({
      kind: "route",
      route: {
        kind: "exercise-question",
        publicPath:
          "practice/snbt/quantitative-knowledge/tryout-2026/set-1/question-9",
      },
    });
    await expect(
      getPracticeMetadataData(
        Promise.resolve({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          locale: "en",
        })
      )
    ).resolves.toMatchObject({
      kind: "domain",
      publicPath: "practice/snbt/quantitative-knowledge",
      sourceMaterial: "quantitative-knowledge",
    });
    expect(runtimeMocks.fetchRuntimeExerciseSetPage).not.toHaveBeenCalled();
    expect(
      runtimeMocks.fetchRuntimeExerciseQuestionPage
    ).not.toHaveBeenCalled();
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
      path: ["tryout-2026", "set-1"],
    });
    const set = await getPracticeRouteData(params);

    expect(set.kind).toBe("set");

    if (set.kind !== "set") {
      return;
    }

    expect(set.pagePath).toBe(
      "/en/practice/snbt/quantitative-knowledge/tryout-2026/set-1"
    );
    expect(set.group.pagePath).toBe("/en/practice/snbt");
    expect(set.group.materialPath).toBe(
      "/en/practice/snbt/quantitative-knowledge"
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
        publicPath: "practice/snbt/quantitative-knowledge/tryout-2026/set-1",
      },
      {
        locale: "id",
        publicPath: "latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1",
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
      routePath: "practice/snbt/quantitative-knowledge/tryout-2026/set-1",
      setPath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
    });
    expect(listPracticeStaticParams()).toEqual(
      expect.arrayContaining([
        {
          assessment: "snbt",
          domain: "quantitative-knowledge",
          path: ["tryout-2026", "set-1"],
        },
        {
          assessment: "snbt",
          domain: "quantitative-knowledge",
        },
      ])
    );
    expect(listPracticeStaticParams("id")).toEqual(
      expect.arrayContaining([
        {
          assessment: "snbt",
          domain: "pengetahuan-kuantitatif",
          path: ["tryout-2026", "set-1"],
        },
        {
          assessment: "snbt",
          domain: "pengetahuan-kuantitatif",
        },
      ])
    );
    expect(listPracticeStaticParams("id")).not.toEqual(
      expect.arrayContaining([
        {
          assessment: "snbt",
          domain: "quantitative-knowledge",
          path: ["tryout", "2026", "set-1"],
        },
      ])
    );

    const singleParams = Promise.resolve({
      assessment: "snbt",
      domain: "quantitative-knowledge",
      locale: "en",
      path: ["tryout-2026", "set-1", "question-9"],
    });
    const single = await getPracticeRouteData(singleParams);

    expect(single.kind).toBe("single");

    if (single.kind !== "single") {
      return;
    }

    expect(single.exerciseCount).toBe(10);
    expect(single.exerciseFilePath).toBe(
      "/en/practice/snbt/quantitative-knowledge/tryout-2026/set-1/question-9"
    );
    await expect(
      getPracticeRuntimeSetPath(singleParams)
    ).resolves.toMatchObject({
      routePath: "practice/snbt/quantitative-knowledge/tryout-2026/set-1",
      setPath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
    });
    await expect(
      getPracticeRuntimeSetPath(
        Promise.resolve({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          locale: "en",
        })
      )
    ).resolves.toEqual({ locale: "en" });

    expect(
      getPracticeQuestionPagination({
        publicSetPath:
          "/id/latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1",
        questionNumber: 2,
        titleFormatter: (number) => `Question ${number}`,
        totalExercises: 3,
      })
    ).toMatchObject({
      next: {
        href: "/id/latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1/soal-3",
      },
      prev: {
        href: "/id/latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1/soal-1",
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
          path: ["tryout-2026"],
        })
      )
    ).rejects.toThrow();
    await expect(
      getPracticeRouteData(
        Promise.resolve({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          locale: "en",
          path: ["tryout", "2026"],
        })
      )
    ).rejects.toThrow();
    await expect(
      getPracticeRouteData(
        Promise.resolve({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          locale: "en",
          path: ["tryout-2027", "set-1"],
        })
      )
    ).rejects.toThrow();
    await expect(
      getPracticeRouteData(
        Promise.resolve({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          locale: "en",
          path: ["tryout-2027", "set-1", "question-1"],
        })
      )
    ).rejects.toThrow();
    await expect(
      getPracticeRouteData(
        Promise.resolve({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          locale: "en",
          path: ["tryout-2026", "set-1", "question-0"],
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
          path: ["tryout-2026", "set-1"],
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
          path: ["tryout-2026", "set-1", "question-9"],
        })
      )
    ).rejects.toThrow();
  });
});

async function importPracticeData() {
  return await import("./data");
}

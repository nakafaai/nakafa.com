import { getNakafaAgentContentIndex } from "@repo/contents/_lib/agent/catalog/source";
import { Effect, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/contents/_lib/mdx-slugs/cache", () => ({
  getMdxSlugsForLocale: () =>
    Effect.succeed([
      "broken-root/high-school/snbt/general-reasoning/set-1/question-1/question",
      "broken/question-1/question",
      "material/practice/assessment/snbt/general-reasoning/try-out/question-1/question",
      "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-1/question-1/question",
    ]),
}));

vi.mock("@repo/contents/_lib/metadata", () => ({
  getContentsMetadata: ({ basePath } = { basePath: "" }) =>
    Effect.succeed(
      basePath === "articles"
        ? [
            {
              metadata: {
                description: "Article description",
                title: "Article",
              },
              slug: "articles/politics/article",
            },
            {
              metadata: {
                description: "Malformed article",
                title: "Malformed Article",
              },
              slug: "articles/example",
            },
          ]
        : [
            {
              metadata: {
                subject: "Subject fallback",
                title: "Subject",
              },
              slug: "material/lesson/mathematics/topic",
            },
            {
              metadata: {
                title: "Empty",
              },
              slug: "material/lesson/mathematics/empty",
            },
          ]
    ),
}));

vi.mock("@repo/contents/_lib/quran", () => ({
  getAllSurah: () => [
    {
      name: {
        translation: {
          en: "Opening",
          id: "Pembuka",
        },
      },
      number: 1,
    },
    {
      name: {
        translation: {
          en: "Invalid",
          id: "Tidak valid",
        },
      },
      number: Number.NaN,
    },
  ],
  getSurahName: () => "Opening",
}));

describe("Nakafa agent content index", () => {
  it("builds summaries and keeps exercises on canonical set routes", async () => {
    const index = await Effect.runPromise(getNakafaAgentContentIndex());
    const exerciseRoutes = index
      .filter((item) => item.route.startsWith("material/practice/"))
      .map((item) => item.route);

    expect(exerciseRoutes).toStrictEqual([
      "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-1",
    ]);
    expect(index).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: "Article description",
          route: "articles/politics/article",
        }),
        expect.objectContaining({
          description: "Subject fallback",
          route: "material/lesson/mathematics/topic",
        }),
        expect.objectContaining({
          description: "",
          route: "material/lesson/mathematics/empty",
        }),
        expect.objectContaining({
          description: "Opening",
          route: "quran/1",
        }),
      ])
    );
    expect(index.map((item) => item.title)).not.toContain("Malformed Article");
    expect(index.map((item) => item.description)).not.toContain("Invalid");
  });

  it("drops exercise summaries when graph projection or ref decoding fails", async () => {
    vi.resetModules();
    vi.doMock("@repo/contents/_lib/mdx-slugs/cache", () => ({
      getMdxSlugsForLocale: () =>
        Effect.succeed([
          "material/practice/assessment/snbt/general-reasoning/missing-set/question-1/question",
          "material/practice/assessment/snbt/general-reasoning/set-1/question-1/question",
        ]),
    }));
    vi.doMock("@repo/contents/_lib/metadata", () => ({
      getContentsMetadata: () => Effect.succeed([]),
    }));
    vi.doMock("@repo/contents/_lib/quran", () => ({
      getAllSurah: () => [],
      getSurahName: () => "",
    }));
    vi.doMock("@repo/contents/_types/graph/projection", () => ({
      getSourceRouteProjectionForRoute: (route: string) => ({
        exercise: {
          groupSegments: ["general-reasoning"],
          ...(route.includes("set-1") ? { setSegment: "set-1" } : {}),
        },
        kind: "exercise-set",
      }),
    }));
    vi.doMock("@repo/contents/_lib/agent/refs", () => ({
      createNakafaContentRef: () => Option.none(),
    }));

    const { getNakafaAgentContentIndex: getIndex } = await import(
      "@repo/contents/_lib/agent/catalog/source"
    );

    expect(await Effect.runPromise(getIndex())).toStrictEqual([]);
  });
});

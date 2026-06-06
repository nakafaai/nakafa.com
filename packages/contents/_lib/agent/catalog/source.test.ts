import { getNakafaAgentContentIndex } from "@repo/contents/_lib/agent/catalog/source";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/contents/_lib/mdx-slugs/cache", () => ({
  getMdxSlugsForLocale: () =>
    Effect.succeed([
      "broken/1/_question",
      "exercises/high-school/snbt/general-reasoning/try-out/1/_question",
      "exercises/high-school/snbt/general-reasoning/try-out/2026/set-1/1/_question",
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
              slug: "articles/article",
            },
          ]
        : [
            {
              metadata: {
                subject: "Subject fallback",
                title: "Subject",
              },
              slug: "subject/topic",
            },
            {
              metadata: {
                title: "Empty",
              },
              slug: "subject/empty",
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
  ],
  getSurahName: () => "Opening",
}));

describe("Nakafa agent content index", () => {
  it("builds summaries and keeps exercises on canonical set routes", async () => {
    const index = await Effect.runPromise(getNakafaAgentContentIndex());
    const exerciseRoutes = index
      .filter((item) => item.section === "exercises")
      .map((item) => item.route);

    expect(exerciseRoutes).toStrictEqual([
      "exercises/high-school/snbt/general-reasoning/try-out/2026/set-1",
    ]);
    expect(index).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: "Article description",
          route: "articles/article",
        }),
        expect.objectContaining({
          description: "Subject fallback",
          route: "subject/topic",
        }),
        expect.objectContaining({
          description: "",
          route: "subject/empty",
        }),
        expect.objectContaining({
          description: "Opening",
          route: "quran/1",
        }),
      ])
    );
  });
});

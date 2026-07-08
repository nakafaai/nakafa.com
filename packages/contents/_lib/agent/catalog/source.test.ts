import { getNakafaAgentContentIndex } from "@repo/contents/_lib/agent/catalog/source";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

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
  it("builds summaries for supported content sources", async () => {
    const index = await Effect.runPromise(getNakafaAgentContentIndex());

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
});

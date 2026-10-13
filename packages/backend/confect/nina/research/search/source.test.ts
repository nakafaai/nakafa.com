import { describe, expect, it } from "@effect/vitest";
import { readSearchSources } from "@repo/backend/confect/nina/research/search/source";

describe("readSearchSources", () => {
  it("reads a title or a description that the provider gives as a list of texts, and ignores one that is null or blank", () => {
    expect(
      readSearchSources({
        web: [
          {
            description: ["  ", "Second description."],
            title: ["Listed title", "Another title"],
            url: "https://lists.example.com/page",
          },
          {
            description: null,
            metadata: {
              description: ["", "Metadata description."],
              title: [],
            },
            title: null,
            url: "https://nulls.example.com/page",
          },
          {
            metadata: null,
            title: "Result without metadata",
            url: "https://plain.example.com/page",
          },
        ],
      })
    ).toEqual([
      {
        content: "",
        description: "Second description.",
        title: "Listed title",
        url: "https://lists.example.com/page",
      },
      {
        content: "",
        description: "Metadata description.",
        title: "",
        url: "https://nulls.example.com/page",
      },
      {
        content: "",
        description: "",
        title: "Result without metadata",
        url: "https://plain.example.com/page",
      },
    ]);
  });

  it("describes a news result by its snippet", () => {
    expect(
      readSearchSources({
        news: [{ snippet: "News snippet.", url: "https://news.example.com/a" }],
      })
    ).toEqual([
      {
        content: "",
        description: "News snippet.",
        title: "",
        url: "https://news.example.com/a",
      },
    ]);
  });
});

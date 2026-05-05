import { NakafaAgentInputError } from "@repo/contents/_lib/agent/errors";
import {
  getNakafaAgentContentIndex,
  searchNakafaAgentContent,
} from "@repo/contents/_lib/agent/search";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

describe("Nakafa agent search", () => {
  it("searches content with pagination, section filters, and direct content IDs", async () => {
    const result = await Effect.runPromise(
      searchNakafaAgentContent({
        limit: 2,
        locale: "en",
        offset: 0,
        query: "quran",
        section: "quran",
      })
    );
    const nextResult = await Effect.runPromise(
      searchNakafaAgentContent({
        limit: 2,
        locale: "en",
        offset: result.next_offset ?? 0,
        section: "quran",
      })
    );
    const index = await Effect.runPromise(getNakafaAgentContentIndex("en"));

    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.section === "quran")).toBe(true);
    expect(result.has_more).toBe(true);
    expect(nextResult.offset).toBe(result.next_offset);
    expect(index.some((item) => item.section === "articles")).toBe(true);
    expect(index.some((item) => item.section === "subject")).toBe(true);
    expect(index.some((item) => item.section === "exercises")).toBe(true);
  });

  it("reports validation errors for invalid search options", async () => {
    const error = await Effect.runPromise(
      Effect.match(searchNakafaAgentContent({ limit: 500 }), {
        onFailure: (failure) => failure,
        onSuccess: () => null,
      })
    );

    expect(error).toBeInstanceOf(NakafaAgentInputError);
  });

  it("returns default and final search pages without a query", async () => {
    const defaultResult = await Effect.runPromise(searchNakafaAgentContent());
    const finalQuranPage = await Effect.runPromise(
      searchNakafaAgentContent({
        limit: 50,
        locale: "en",
        offset: 100,
        section: "quran",
      })
    );
    const emptyQueryResult = await Effect.runPromise(
      searchNakafaAgentContent({
        limit: 5,
        locale: "en",
        query: "not-a-real-nakafa-content-title",
        section: "articles",
      })
    );

    expect(defaultResult.items.length).toBeGreaterThan(0);
    expect(finalQuranPage.has_more).toBe(false);
    expect(finalQuranPage.next_offset).toBeNull();
    expect(emptyQueryResult.items).toStrictEqual([]);
  });

  it("builds the default locale content index", async () => {
    const index = await Effect.runPromise(getNakafaAgentContentIndex());

    expect(index.some((item) => item.locale === "en")).toBe(true);
  });

  it("filters non-canonical exercise set paths from the public index", async () => {
    vi.resetModules();
    vi.doMock("@repo/contents/_lib/cache", () => ({
      getMDXSlugsForLocale: () => [
        "exercises/high-school/snbt/1/_question",
        "exercises/high-school/snbt/general-reasoning/try-out/1/_question",
        "exercises/high-school/snbt/general-reasoning/try-out/set-1/1/_question",
        "exercises/high-school/snbt/general-reasoning/try-out/2026/set-1/1/_question",
      ],
    }));
    vi.doMock("@repo/contents/_lib/metadata", () => ({
      getContentsMetadata: ({ basePath }: { basePath?: string }) =>
        Effect.succeed([
          {
            locale: "en",
            metadata: {
              authors: [{ name: "Nakafa" }],
              date: "01/01/2026",
              title: basePath === "articles" ? "Article" : "Subject",
              ...(basePath === "subject" ? { subject: "Fallback" } : {}),
            },
            slug:
              basePath === "articles" ? "articles/example" : "subject/example",
            url: "https://nakafa.com/en/example",
          },
        ]),
    }));
    vi.doMock("@repo/contents/_lib/quran", () => ({
      getAllSurah: () => [],
      getSurahName: () => "Surah",
    }));

    const { getNakafaAgentContentIndex } = await import(
      "@repo/contents/_lib/agent/search"
    );
    const index = await Effect.runPromise(getNakafaAgentContentIndex("en"));
    const exerciseItems = index.filter((item) => item.section === "exercises");
    const subject = index.find((item) => item.section === "subject");

    expect(exerciseItems.map((item) => item.route)).toStrictEqual([
      "exercises/high-school/snbt/general-reasoning/try-out/2026/set-1",
    ]);
    expect(subject?.description).toBe("Fallback");
    vi.doUnmock("@repo/contents/_lib/cache");
    vi.doUnmock("@repo/contents/_lib/metadata");
    vi.doUnmock("@repo/contents/_lib/quran");
    vi.resetModules();
  });
});

import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { search } from "@repo/ai/agents/nakafa/tools/search";
import { createWriter } from "@repo/ai/agents/nakafa/tools/test";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("nakafa search tool", () => {
  it("writes loading and done parts for search results", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 1,
          locale: "en",
          offset: 0,
          query: "quran",
          section: "quran",
        },
        locale: "en",
        toolCallId: "search-1",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          search: (input) =>
            Effect.succeed({
              count: 1,
              has_more: false,
              items: [
                {
                  content_id: "en/quran/1",
                  description: "The Opening",
                  locale: input.locale,
                  markdown_url: "https://nakafa.com/en/quran/1.md",
                  route: "quran/1",
                  section: "quran",
                  title: "1. Al-Fatihah",
                  url: "https://nakafa.com/en/quran/1",
                },
              ],
              limit: input.limit,
              next_offset: null,
              offset: input.offset,
            }),
        })
      )
    );

    expect(output.text).toContain("# Nakafa Search");
    expect(output.result).toEqual(expect.objectContaining({ count: 1 }));
    expect(parts).toEqual([
      expect.objectContaining({
        type: "data-nakafa",
        data: expect.objectContaining({ kind: "search", status: "loading" }),
      }),
      expect.objectContaining({
        type: "data-nakafa",
        data: expect.objectContaining({
          kind: "search",
          status: "done",
          result: expect.objectContaining({ count: 1 }),
        }),
      }),
    ]);
  });

  it("writes an error part when Convex-backed search fails", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 99,
          locale: "en",
          offset: 0,
        },
        locale: "en",
        toolCallId: "search-2",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          search: () =>
            Effect.fail(
              new NakafaAgentDataReadError({
                message: "Unable to search Nakafa content.",
              })
            ),
        })
      )
    );

    expect(output).toEqual({
      result: null,
      text: "Unable to search Nakafa content.",
    });
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "search", status: "error" }),
      })
    );
  });

  it("formats empty search results without a next offset", async () => {
    const { writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 1,
          locale: "en",
          offset: 0,
          query: "!!!",
        },
        locale: "en",
        toolCallId: "search-3",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          search: (input) =>
            Effect.succeed({
              count: 0,
              has_more: false,
              items: [],
              limit: input.limit,
              next_offset: null,
              offset: input.offset,
            }),
        })
      )
    );

    expect(output.text).toContain("- Next offset: none");
  });

  it("uses the server locale instead of the model-provided locale", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 1,
          locale: "en",
          offset: 0,
          query: "cari materi fungsi rasional kelas 11",
          section: "subject",
        },
        locale: "id",
        toolCallId: "search-locale",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          search: (input) =>
            Effect.succeed({
              count: 1,
              has_more: false,
              items: [
                {
                  content_id:
                    "id/subject/high-school/11/mathematics/function-modeling/rational-function",
                  description: "Pelajari fungsi rasional.",
                  locale: input.locale,
                  markdown_url:
                    "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/rational-function.md",
                  route:
                    "subject/high-school/11/mathematics/function-modeling/rational-function",
                  section: "subject",
                  title: "Fungsi Rasional",
                  url: "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/rational-function",
                },
              ],
              limit: input.limit,
              next_offset: null,
              offset: input.offset,
            }),
        })
      )
    );

    expect(output.text).toContain("Fungsi Rasional");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          input: expect.objectContaining({ locale: "id" }),
          result: expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({ title: "Fungsi Rasional" }),
            ]),
          }),
        }),
      })
    );
  });

  it("preserves model-selected section filters", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 3,
          locale: "en",
          offset: 0,
          query: "cari materi fungsi rasional kelas 11",
          section: "articles",
        },
        locale: "id",
        toolCallId: "search-study",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          search: (input) =>
            Effect.succeed({
              count: 1,
              has_more: false,
              items: [
                {
                  content_id: "id/articles/politics/example",
                  description: "Analisis politik.",
                  locale: input.locale,
                  markdown_url:
                    "https://nakafa.com/id/articles/politics/example.md",
                  route: "articles/politics/example",
                  section: "articles",
                  title: "Artikel Politik",
                  url: "https://nakafa.com/id/articles/politics/example",
                },
              ],
              limit: input.limit,
              next_offset: null,
              offset: input.offset,
            }),
        })
      )
    );

    expect(output.text).toContain("Artikel Politik");
    expect(parts.at(0)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          input: expect.objectContaining({ section: "articles" }),
        }),
      })
    );
  });
});

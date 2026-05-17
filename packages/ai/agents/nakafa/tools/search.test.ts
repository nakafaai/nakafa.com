import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { search } from "@repo/ai/agents/nakafa/tools/search";
import { createWriter } from "@repo/ai/agents/nakafa/tools/test";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

function getSearchParts(parts: ReturnType<typeof createWriter>["parts"]) {
  return parts.flatMap((part) => {
    if (part.type !== "data-nakafa" || part.data.kind !== "search") {
      return [];
    }

    return [part.data];
  });
}

describe("nakafa search tool", () => {
  it("writes loading and done parts for search results", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 1,
          locale: "en",
          offset: 0,
          queries: ["quran"],
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
          queries: ["!!!"],
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

  it("formats unscoped search results when no query text is provided", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 1,
          locale: "en",
          offset: 0,
        },
        locale: "en",
        toolCallId: "search-unscoped",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          search: (input) =>
            Effect.succeed({
              count: 1,
              has_more: false,
              items: [
                {
                  content_id: "en/articles/example",
                  description: "Example article.",
                  locale: input.locale,
                  markdown_url: "https://nakafa.com/en/articles/example.md",
                  route: "articles/example",
                  section: "articles",
                  title: "Example Article",
                  url: "https://nakafa.com/en/articles/example",
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
    expect(output.text).not.toContain("# Nakafa Search Query");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          input: expect.not.objectContaining({ queries: expect.anything() }),
        }),
      })
    );
  });

  it("uses the server locale instead of the model-provided locale", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 1,
          locale: "en",
          offset: 0,
          queries: ["cari materi fungsi rasional kelas 11"],
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
          queries: ["cari materi fungsi rasional kelas 11"],
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

  it("preserves alternate query variants for one section", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 3,
          locale: "en",
          offset: 0,
          queries: ["kimia kelas 10", "hukum kekekalan massa", "stoikiometri"],
          section: "subject",
        },
        locale: "id",
        toolCallId: "search-queries",
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
                    "id/subject/high-school/10/chemistry/basic-chemistry-laws/mass-conservation-law",
                  description: "Pelajari hukum kekekalan massa.",
                  locale: input.locale,
                  markdown_url:
                    "https://nakafa.com/id/subject/high-school/10/chemistry/basic-chemistry-laws/mass-conservation-law.md",
                  route:
                    "subject/high-school/10/chemistry/basic-chemistry-laws/mass-conservation-law",
                  section: "subject",
                  title: "Hukum Kekekalan Massa",
                  url: "https://nakafa.com/id/subject/high-school/10/chemistry/basic-chemistry-laws/mass-conservation-law",
                },
              ],
              limit: input.limit,
              next_offset: null,
              offset: input.offset,
            }),
        })
      )
    );

    expect(output.text).toContain("Hukum Kekekalan Massa");
    expect(output.text).toContain('- Query: "hukum kekekalan massa"');
    expect(output.result).toEqual(expect.objectContaining({ count: 1 }));
    expect(
      getSearchParts(parts)
        .filter((part) => part.status === "loading")
        .map((part) => part.input.queries)
    ).toEqual([
      ["kimia kelas 10"],
      ["hukum kekekalan massa"],
      ["stoikiometri"],
    ]);
    expect(
      getSearchParts(parts)
        .filter((part) => part.status === "done")
        .map((part) => part.input.queries)
    ).toEqual([
      ["kimia kelas 10"],
      ["hukum kekekalan massa"],
      ["stoikiometri"],
    ]);
  });

  it("executes the model-provided exercise query unchanged", async () => {
    const { parts, writer } = createWriter();
    const capturedQueries: string[][] = [];

    await Effect.runPromise(
      search({
        input: {
          limit: 10,
          locale: "id",
          offset: 0,
          queries: ["SNBT Pengetahuan Kuantitatif try out 2026 set 2"],
          section: "exercises",
        },
        locale: "id",
        toolCallId: "search-exercise-set",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          search: (input) => {
            capturedQueries.push(input.queries ?? []);

            return Effect.succeed({
              count: 1,
              has_more: false,
              items: [
                {
                  content_id:
                    "id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2",
                  description:
                    "SMA SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2 20 soal",
                  locale: input.locale,
                  markdown_url:
                    "https://nakafa.com/id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2.md",
                  route:
                    "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2",
                  section: "exercises",
                  title: "SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2",
                  url: "https://nakafa.com/id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2",
                },
              ],
              limit: input.limit,
              next_offset: null,
              offset: input.offset,
            });
          },
        })
      )
    );

    expect(capturedQueries).toEqual([
      ["SNBT Pengetahuan Kuantitatif try out 2026 set 2"],
    ]);
    expect(
      getSearchParts(parts)
        .filter((part) => part.status === "loading")
        .map((part) => part.input.queries)
    ).toEqual([["SNBT Pengetahuan Kuantitatif try out 2026 set 2"]]);
  });

  it("does not change an already anchored exercise query", async () => {
    const { writer } = createWriter();
    const capturedQueries: string[][] = [];
    const query = "SNBT 2026 2 aljabar campuran";

    await Effect.runPromise(
      search({
        input: {
          limit: 10,
          locale: "id",
          offset: 0,
          queries: [query],
          section: "exercises",
        },
        locale: "id",
        toolCallId: "search-exercise-number",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          search: (input) => {
            capturedQueries.push(input.queries ?? []);

            return Effect.succeed({
              count: 0,
              has_more: false,
              items: [],
              limit: input.limit,
              next_offset: null,
              offset: input.offset,
            });
          },
        })
      )
    );

    expect(capturedQueries).toEqual([[query]]);
  });

  it("leaves exercise search unchanged", async () => {
    const { writer } = createWriter();
    const capturedQueries: string[][] = [];

    await Effect.runPromise(
      search({
        input: {
          limit: 10,
          locale: "id",
          offset: 0,
          queries: ["Pengetahuan Kuantitatif SNBT"],
          section: "exercises",
        },
        locale: "id",
        toolCallId: "search-exercise-query",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          search: (input) => {
            capturedQueries.push(input.queries ?? []);

            return Effect.succeed({
              count: 0,
              has_more: false,
              items: [],
              limit: input.limit,
              next_offset: null,
              offset: input.offset,
            });
          },
        })
      )
    );

    expect(capturedQueries).toEqual([["Pengetahuan Kuantitatif SNBT"]]);
  });

  it("does not synthesize a query when the model omitted query text", async () => {
    const { writer } = createWriter();
    const capturedQueries: string[][] = [];

    await Effect.runPromise(
      search({
        input: {
          limit: 10,
          locale: "id",
          offset: 0,
          section: "exercises",
        },
        locale: "id",
        toolCallId: "search-exercise-without-query",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          search: (input) => {
            capturedQueries.push(input.queries ?? []);

            return Effect.succeed({
              count: 0,
              has_more: false,
              items: [],
              limit: input.limit,
              next_offset: null,
              offset: input.offset,
            });
          },
        })
      )
    );

    expect(capturedQueries).toEqual([[]]);
  });

  it("keeps exercise UI query-scoped while aggregate selection stays ranked", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 2,
          locale: "id",
          offset: 0,
          queries: ["pola bilangan", "Penalaran Matematika"],
          section: "exercises",
        },
        locale: "id",
        toolCallId: "search-exercise-combined",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          search: (input) => {
            if (input.queries?.at(0) === "Penalaran Matematika") {
              return Effect.succeed({
                count: 1,
                has_more: false,
                items: [
                  {
                    content_id:
                      "id/exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-1",
                    description:
                      "SNBT Penalaran Matematika Try Out 2026 Set 1 pola bilangan",
                    locale: input.locale,
                    markdown_url:
                      "https://nakafa.com/id/exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-1.md",
                    route:
                      "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-1",
                    section: "exercises",
                    title: "SNBT Penalaran Matematika Try Out 2026 Set 1",
                    url: "https://nakafa.com/id/exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-1",
                  },
                ],
                limit: input.limit,
                next_offset: null,
                offset: input.offset,
              });
            }

            return Effect.succeed({
              count: 1,
              has_more: false,
              items: [
                {
                  content_id:
                    "id/exercises/high-school/snbt/indonesian-language/try-out/2026/set-1/1",
                  description:
                    "Soal Bahasa Indonesia yang menyebut pola bilangan.",
                  locale: input.locale,
                  markdown_url:
                    "https://nakafa.com/id/exercises/high-school/snbt/indonesian-language/try-out/2026/set-1/1.md",
                  route:
                    "exercises/high-school/snbt/indonesian-language/try-out/2026/set-1/1",
                  section: "exercises",
                  title: "Soal 1 Bahasa Indonesia",
                  url: "https://nakafa.com/id/exercises/high-school/snbt/indonesian-language/try-out/2026/set-1/1",
                },
              ],
              limit: input.limit,
              next_offset: null,
              offset: input.offset,
            });
          },
        })
      )
    );

    const searchParts = getSearchParts(parts);
    const doneParts = searchParts.filter((part) => part.status === "done");

    expect(output.result?.items[0]?.content_id).toContain(
      "mathematical-reasoning"
    );
    expect(doneParts).toHaveLength(2);
    expect(doneParts.map((part) => part.input.queries)).toEqual([
      ["pola bilangan"],
      ["Penalaran Matematika"],
    ]);
    expect(
      doneParts.some((part) =>
        part.result?.items.some(
          (item) => item.content_id === output.result?.items[0]?.content_id
        )
      )
    ).toBe(true);
  });

  it("writes query-scoped exercise error parts when every query fails", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 2,
          locale: "id",
          offset: 0,
          queries: ["pola bilangan", "Penalaran Matematika"],
          section: "exercises",
        },
        locale: "id",
        toolCallId: "search-exercise-scoped-error",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          search: () =>
            Effect.fail(
              new NakafaAgentDataReadError({
                message: "Unable to search Nakafa exercises.",
              })
            ),
        })
      )
    );

    const searchParts = getSearchParts(parts);

    expect(output).toEqual({
      result: null,
      text: [
        "Unable to search Nakafa exercises.",
        "Unable to search Nakafa exercises.",
      ].join("\n"),
    });
    expect(
      searchParts
        .filter((part) => part.status === "loading")
        .map((part) => part.input.queries)
    ).toEqual([["pola bilangan"], ["Penalaran Matematika"]]);
    expect(
      searchParts
        .filter((part) => part.status === "error")
        .map((part) => part.input.queries)
    ).toEqual([["pola bilangan"], ["Penalaran Matematika"]]);
    expect(
      searchParts
        .filter((part) => part.status === "error")
        .map((part) => part.error)
    ).toEqual([
      "Unable to search Nakafa exercises.",
      "Unable to search Nakafa exercises.",
    ]);
  });

  it("keeps combined exercise order when query tokens are empty", async () => {
    const { writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 2,
          locale: "id",
          offset: 0,
          queries: ["!!!", "???"],
          section: "exercises",
        },
        locale: "id",
        toolCallId: "search-exercise-empty-tokens",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          search: (input) =>
            Effect.succeed({
              count: 1,
              has_more: false,
              items: [
                {
                  content_id: `id/exercises/${input.queries?.at(0) ?? "empty"}`,
                  description: "",
                  locale: input.locale,
                  markdown_url: "https://nakafa.com/id/exercises/item.md",
                  route: `exercises/${input.queries?.at(0) ?? "empty"}`,
                  section: "exercises",
                  title: input.queries?.at(0) ?? "empty",
                  url: "https://nakafa.com/id/exercises/item",
                },
              ],
              limit: input.limit,
              next_offset: null,
              offset: input.offset,
            }),
        })
      )
    );

    expect(output.result?.items.map((item) => item.title)).toEqual([
      "!!!",
      "???",
    ]);
  });

  it("prefers exercise set rows over question rows when combined scores tie", async () => {
    const { writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 2,
          locale: "id",
          offset: 0,
          queries: ["pola", "bilangan"],
          section: "exercises",
        },
        locale: "id",
        toolCallId: "search-exercise-tie",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          search: (input) => {
            if (input.queries?.at(0) === "bilangan") {
              return Effect.succeed({
                count: 1,
                has_more: false,
                items: [
                  {
                    content_id:
                      "id/exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-1",
                    description: "pola",
                    locale: input.locale,
                    markdown_url:
                      "https://nakafa.com/id/exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-1.md",
                    route:
                      "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-1",
                    section: "exercises",
                    title: "Set Penalaran Matematika",
                    url: "https://nakafa.com/id/exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-1",
                  },
                ],
                limit: input.limit,
                next_offset: null,
                offset: input.offset,
              });
            }

            return Effect.succeed({
              count: 1,
              has_more: false,
              items: [
                {
                  content_id:
                    "id/exercises/high-school/snbt/indonesian-language/try-out/2026/set-1/1",
                  description: "pola",
                  locale: input.locale,
                  markdown_url:
                    "https://nakafa.com/id/exercises/high-school/snbt/indonesian-language/try-out/2026/set-1/1.md",
                  route:
                    "exercises/high-school/snbt/indonesian-language/try-out/2026/set-1/1",
                  section: "exercises",
                  title: "Soal 1",
                  url: "https://nakafa.com/id/exercises/high-school/snbt/indonesian-language/try-out/2026/set-1/1",
                },
              ],
              limit: input.limit,
              next_offset: null,
              offset: input.offset,
            });
          },
        })
      )
    );

    expect(output.result?.items[0]?.content_id).toContain(
      "mathematical-reasoning"
    );
  });

  it("executes non-exercise queries unchanged", async () => {
    const { writer } = createWriter();
    const capturedQueries: string[][] = [];

    await Effect.runPromise(
      search({
        input: {
          limit: 10,
          locale: "id",
          offset: 0,
          queries: ["fungsi kuadrat"],
          section: "subject",
        },
        locale: "id",
        toolCallId: "search-exercise-no-hints",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          search: (input) => {
            capturedQueries.push(input.queries ?? []);

            return Effect.succeed({
              count: 0,
              has_more: false,
              items: [],
              limit: input.limit,
              next_offset: null,
              offset: input.offset,
            });
          },
        })
      )
    );

    expect(capturedQueries).toEqual([["fungsi kuadrat"]]);
  });

  it("interleaves query results before returning the agent aggregate", async () => {
    const { writer } = createWriter();
    const output = await Effect.runPromise(
      search({
        input: {
          limit: 2,
          locale: "en",
          offset: 5,
          queries: ["alpha", "beta", "gamma"],
          section: "articles",
        },
        locale: "en",
        toolCallId: "search-interleave",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          search: (input) => {
            if (input.queries?.at(0) === "beta") {
              return Effect.succeed({
                count: 1,
                has_more: true,
                items: [
                  {
                    content_id: "en/articles/a",
                    description: "Duplicate article.",
                    locale: input.locale,
                    markdown_url: "https://nakafa.com/en/articles/a.md",
                    route: "articles/a",
                    section: "articles",
                    title: "Duplicate Article",
                    url: "https://nakafa.com/en/articles/a",
                  },
                ],
                limit: input.limit,
                next_offset: 6,
                offset: input.offset,
              });
            }

            if (input.queries?.at(0) === "gamma") {
              return Effect.succeed({
                count: 0,
                has_more: false,
                items: [],
                limit: input.limit,
                next_offset: null,
                offset: input.offset,
              });
            }

            return Effect.succeed({
              count: 2,
              has_more: false,
              items: [
                {
                  content_id: "en/articles/a",
                  description: "First article.",
                  locale: input.locale,
                  markdown_url: "https://nakafa.com/en/articles/a.md",
                  route: "articles/a",
                  section: "articles",
                  title: "First Article",
                  url: "https://nakafa.com/en/articles/a",
                },
                {
                  content_id: "en/articles/b",
                  description: "Second article.",
                  locale: input.locale,
                  markdown_url: "https://nakafa.com/en/articles/b.md",
                  route: "articles/b",
                  section: "articles",
                  title: "Second Article",
                  url: "https://nakafa.com/en/articles/b",
                },
              ],
              limit: input.limit,
              next_offset: null,
              offset: input.offset,
            });
          },
        })
      )
    );

    expect(output.result).toEqual(
      expect.objectContaining({
        has_more: true,
        next_offset: 7,
        offset: 5,
      })
    );
    expect(output.result?.items.map((item) => item.content_id)).toEqual([
      "en/articles/a",
      "en/articles/b",
    ]);
  });
});

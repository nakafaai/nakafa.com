import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { search } from "@repo/ai/agents/nakafa/tools/search";
import { createWriter } from "@repo/ai/agents/nakafa/tools/test";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import type { NakafaAgentSection } from "@repo/contents/_lib/agent/schema/ref";
import { NakafaAgentSearchResultSchema } from "@repo/contents/_lib/agent/schema/search";
import type { Locale } from "@repo/contents/_types/content";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

/** Extracts Nakafa search data parts from a recorded test writer stream. */
function getSearchParts(parts: ReturnType<typeof createWriter>["parts"]) {
  return parts.flatMap((part) => {
    if (part.type !== "data-nakafa" || part.data.kind !== "search") {
      return [];
    }

    return [part.data];
  });
}

/** Decodes raw search fixtures through the production Nakafa search schema. */
function searchResult(value: unknown) {
  return Schema.decodeUnknownSync(NakafaAgentSearchResultSchema)(value);
}

interface SearchItemFixture {
  description: string;
  excerpt?: string;
  locale: Locale;
  route: string;
  section: NakafaAgentSection;
  title: string;
}

/** Builds one graph-backed search fixture from canonical route parts. */
function searchItem({
  description,
  excerpt,
  locale,
  route,
  section,
  title,
}: SearchItemFixture) {
  return {
    ...readNakafaContentRefFixture(locale, route, section),
    description,
    excerpt: excerpt ?? description,
    title,
  };
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
          /** Returns one Quran result for the basic loading/done UI flow. */
          search: (input) =>
            Effect.succeed(
              searchResult({
                count: 1,
                has_more: false,
                items: [
                  searchItem({
                    description: "The Opening",
                    locale: input.locale,
                    route: "quran/1",
                    section: "quran",
                    title: "1. Al-Fatihah",
                  }),
                ],
                limit: input.limit,
                offset: input.offset,
              })
            ),
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
          /** Fails the search adapter to verify error part emission. */
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
          /** Returns no results for the empty-state search flow. */
          search: (input) =>
            Effect.succeed(
              searchResult({
                count: 0,
                has_more: false,
                items: [],
                limit: input.limit,
                offset: input.offset,
              })
            ),
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
          /** Returns one article result for an unscoped empty-query search. */
          search: (input) =>
            Effect.succeed(
              searchResult({
                count: 1,
                has_more: false,
                items: [
                  searchItem({
                    description: "Example article.",
                    locale: input.locale,
                    route: "articles/politics/example",
                    section: "articles",
                    title: "Example Article",
                  }),
                ],
                limit: input.limit,
                offset: input.offset,
              })
            ),
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
          section: "material",
        },
        locale: "id",
        toolCallId: "search-locale",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          /** Returns one subject result using the normalized request locale. */
          search: (input) =>
            Effect.succeed(
              searchResult({
                count: 1,
                has_more: false,
                items: [
                  searchItem({
                    description: "Pelajari fungsi rasional.",
                    locale: input.locale,
                    route:
                      "material/lesson/mathematics/function-modeling/rational-function",
                    section: "material",
                    title: "Fungsi Rasional",
                  }),
                ],
                limit: input.limit,
                offset: input.offset,
              })
            ),
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
          /** Returns one politics article result for study-task formatting. */
          search: (input) =>
            Effect.succeed(
              searchResult({
                count: 1,
                has_more: false,
                items: [
                  searchItem({
                    description: "Analisis politik.",
                    locale: input.locale,
                    route: "articles/politics/example",
                    section: "articles",
                    title: "Artikel Politik",
                  }),
                ],
                limit: input.limit,
                offset: input.offset,
              })
            ),
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
          section: "material",
        },
        locale: "id",
        toolCallId: "search-queries",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          /** Returns one subject result for multi-query token forwarding. */
          search: (input) =>
            Effect.succeed(
              searchResult({
                count: 1,
                has_more: false,
                items: [
                  searchItem({
                    description: "Pelajari hukum kekekalan massa.",
                    locale: input.locale,
                    route:
                      "material/lesson/chemistry/basic-chemistry-laws/mass-conservation-law",
                    section: "material",
                    title: "Hukum Kekekalan Massa",
                  }),
                ],
                limit: input.limit,
                offset: input.offset,
              })
            ),
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
          section: "material",
        },
        locale: "id",
        toolCallId: "search-exercise-set",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          /** Captures the exact exercise-set query and returns the matching set row. */
          search: (input) => {
            capturedQueries.push(input.queries ?? []);

            return Effect.succeed(
              searchResult({
                count: 1,
                has_more: false,
                items: [
                  searchItem({
                    description:
                      "SMA SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2 20 soal",
                    locale: input.locale,
                    route:
                      "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-2",
                    section: "material",
                    title: "SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2",
                  }),
                ],
                limit: input.limit,
                offset: input.offset,
              })
            );
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
          section: "material",
        },
        locale: "id",
        toolCallId: "search-exercise-number",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          /** Captures the anchored exercise query and returns an empty result. */
          search: (input) => {
            capturedQueries.push(input.queries ?? []);

            return Effect.succeed(
              searchResult({
                count: 0,
                has_more: false,
                items: [],
                limit: input.limit,
                offset: input.offset,
              })
            );
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
          section: "material",
        },
        locale: "id",
        toolCallId: "search-exercise-query",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          /** Captures the exercise query and returns an empty result. */
          search: (input) => {
            capturedQueries.push(input.queries ?? []);

            return Effect.succeed(
              searchResult({
                count: 0,
                has_more: false,
                items: [],
                limit: input.limit,
                offset: input.offset,
              })
            );
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
          section: "material",
        },
        locale: "id",
        toolCallId: "search-exercise-without-query",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          /** Captures the omitted exercise query list and returns no rows. */
          search: (input) => {
            capturedQueries.push(input.queries ?? []);

            return Effect.succeed(
              searchResult({
                count: 0,
                has_more: false,
                items: [],
                limit: input.limit,
                offset: input.offset,
              })
            );
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
          section: "material",
        },
        locale: "id",
        toolCallId: "search-exercise-combined",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          /** Returns query-specific exercise rows to verify UI and aggregate ranking. */
          search: (input) => {
            if (input.queries?.at(0) === "Penalaran Matematika") {
              return Effect.succeed(
                searchResult({
                  count: 1,
                  has_more: false,
                  items: [
                    searchItem({
                      description:
                        "SNBT Penalaran Matematika Try Out 2026 Set 1 pola bilangan",
                      locale: input.locale,
                      route:
                        "material/practice/assessment/snbt/mathematical-reasoning/try-out-2026/set-1",
                      section: "material",
                      title: "SNBT Penalaran Matematika Try Out 2026 Set 1",
                    }),
                  ],
                  limit: input.limit,
                  offset: input.offset,
                })
              );
            }

            return Effect.succeed(
              searchResult({
                count: 1,
                has_more: false,
                items: [
                  searchItem({
                    description:
                      "Soal Bahasa Indonesia yang menyebut pola bilangan.",
                    locale: input.locale,
                    route:
                      "material/practice/assessment/snbt/indonesian-language/try-out-2026/set-1/question-1",
                    section: "material",
                    title: "Soal 1 Bahasa Indonesia",
                  }),
                ],
                limit: input.limit,
                offset: input.offset,
              })
            );
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
          section: "material",
        },
        locale: "id",
        toolCallId: "search-exercise-scoped-error",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          /** Fails every scoped exercise query to verify per-query error parts. */
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
          section: "material",
        },
        locale: "id",
        toolCallId: "search-exercise-empty-tokens",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          /** Returns empty-excerpt exercise rows for punctuation-only queries. */
          search: (input) => {
            const query = input.queries?.at(0) ?? "empty";
            const route =
              query === "???"
                ? "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-2"
                : "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-1";

            return Effect.succeed(
              searchResult({
                count: 1,
                has_more: false,
                items: [
                  searchItem({
                    description: "",
                    locale: input.locale,
                    route,
                    section: "material",
                    title: query,
                  }),
                ],
                limit: input.limit,
                offset: input.offset,
              })
            );
          },
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
          section: "material",
        },
        locale: "id",
        toolCallId: "search-exercise-tie",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          /** Returns set and question rows to verify set preference on ranking ties. */
          search: (input) => {
            if (input.queries?.at(0) === "bilangan") {
              return Effect.succeed(
                searchResult({
                  count: 1,
                  has_more: false,
                  items: [
                    searchItem({
                      description: "pola",
                      excerpt: "pola",
                      locale: input.locale,
                      route:
                        "material/practice/assessment/snbt/mathematical-reasoning/try-out-2026/set-1",
                      section: "material",
                      title: "Set Penalaran Matematika",
                    }),
                  ],
                  limit: input.limit,
                  offset: input.offset,
                })
              );
            }

            return Effect.succeed(
              searchResult({
                count: 1,
                has_more: false,
                items: [
                  searchItem({
                    description: "pola",
                    excerpt: "pola",
                    locale: input.locale,
                    route:
                      "material/practice/assessment/snbt/indonesian-language/try-out-2026/set-1/question-1",
                    section: "material",
                    title: "Soal 1",
                  }),
                ],
                limit: input.limit,
                offset: input.offset,
              })
            );
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
          section: "material",
        },
        locale: "id",
        toolCallId: "search-exercise-no-hints",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          /** Captures non-exercise queries and returns an empty result. */
          search: (input) => {
            capturedQueries.push(input.queries ?? []);

            return Effect.succeed(
              searchResult({
                count: 0,
                has_more: false,
                items: [],
                limit: input.limit,
                offset: input.offset,
              })
            );
          },
        })
      )
    );

    expect(capturedQueries).toEqual([["fungsi kuadrat"]]);
  });

  it("ranks non-exercise UI results by query metadata relevance", async () => {
    const { parts, writer } = createWriter();

    await Effect.runPromise(
      search({
        input: {
          limit: 2,
          locale: "id",
          offset: 0,
          queries: ["pola bilangan aritmatika dasar"],
          section: "material",
        },
        locale: "id",
        toolCallId: "search-subject-ranking",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          /** Returns ranked subject rows for UI result ordering checks. */
          search: (input) =>
            Effect.succeed(
              searchResult({
                count: 2,
                has_more: false,
                items: [
                  searchItem({
                    description: "Operasi aritmatika dasar.",
                    locale: input.locale,
                    route:
                      "material/lesson/mathematics/arithmetic/arithmetic-operators",
                    section: "material",
                    title: "Operator Aritmatika",
                  }),
                  searchItem({
                    description: "Pola bilangan pada barisan aritmatika.",
                    locale: input.locale,
                    route:
                      "material/lesson/mathematics/sequence/arithmetic-sequence",
                    section: "material",
                    title: "Barisan Aritmatika",
                  }),
                ],
                limit: input.limit,
                offset: input.offset,
              })
            ),
        })
      )
    );

    const donePart = getSearchParts(parts).find(
      (part) => part.status === "done"
    );

    expect(donePart?.result?.items[0]?.title).toBe("Barisan Aritmatika");
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
          /** Returns duplicate, empty, and paginated rows for aggregation behavior. */
          search: (input) => {
            if (input.queries?.at(0) === "beta") {
              return Effect.succeed(
                searchResult({
                  count: 1,
                  has_more: true,
                  items: [
                    searchItem({
                      description: "Duplicate article.",
                      locale: input.locale,
                      route: "articles/politics/a",
                      section: "articles",
                      title: "Duplicate Article",
                    }),
                  ],
                  limit: input.limit,
                  next_offset: 6,
                  offset: input.offset,
                })
              );
            }

            if (input.queries?.at(0) === "gamma") {
              return Effect.succeed(
                searchResult({
                  count: 0,
                  has_more: false,
                  items: [],
                  limit: input.limit,
                  offset: input.offset,
                })
              );
            }

            return Effect.succeed(
              searchResult({
                count: 2,
                has_more: false,
                items: [
                  searchItem({
                    description: "First article.",
                    locale: input.locale,
                    route: "articles/politics/a",
                    section: "articles",
                    title: "First Article",
                  }),
                  searchItem({
                    description: "Second article.",
                    locale: input.locale,
                    route: "articles/politics/b",
                    section: "articles",
                    title: "Second Article",
                  }),
                ],
                limit: input.limit,
                offset: input.offset,
              })
            );
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
      searchItem({
        description: "First article.",
        locale: "en",
        route: "articles/politics/a",
        section: "articles",
        title: "First Article",
      }).content_id,
      searchItem({
        description: "Second article.",
        locale: "en",
        route: "articles/politics/b",
        section: "articles",
        title: "Second Article",
      }).content_id,
    ]);
  });
});

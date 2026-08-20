import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { search } from "@repo/ai/agents/nakafa/tools/search";
import {
  createWriter,
  makeSnbtSectionRef,
} from "@repo/ai/agents/nakafa/tools/test";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import type { NakafaAgentSection } from "@repo/contents/_lib/agent/schema/ref";
import { NakafaAgentSearchResultSchema } from "@repo/contents/_lib/agent/schema/search";
import type { Locale } from "@repo/contents/_types/content";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect, Schema } from "effect";

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
  sectionKey?: string;
  setKey?: string;
  title: string;
}

/** Builds one graph-backed search fixture from canonical route parts. */
function searchItem({
  description,
  excerpt,
  locale,
  route,
  section,
  sectionKey,
  setKey,
  title,
}: SearchItemFixture) {
  const ref =
    section === "tryout" && sectionKey && setKey
      ? makeSnbtSectionRef(locale, route, setKey, sectionKey)
      : readNakafaContentRefFixture(locale, route, section);

  return {
    ...ref,
    description,
    excerpt: excerpt ?? description,
    title,
  };
}

describe("nakafa search tool", () => {
  it.live("writes loading and done parts for search results", () =>
    Effect.gen(function* () {
      const { parts, writer } = createWriter();
      const output = yield* search({
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
    })
  );

  it.live("writes an error part when Convex-backed search fails", () =>
    Effect.gen(function* () {
      const { parts, writer } = createWriter();
      const output = yield* search({
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
    })
  );

  it.live("formats empty search results without a next offset", () =>
    Effect.gen(function* () {
      const { writer } = createWriter();
      const output = yield* search({
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
      );

      expect(output.text).toContain("- Next offset: none");
    })
  );

  it.live(
    "formats unscoped search results when no query text is provided",
    () =>
      Effect.gen(function* () {
        const { parts, writer } = createWriter();
        const output = yield* search({
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
        );

        expect(output.text).toContain("# Nakafa Search");
        expect(output.text).not.toContain("# Nakafa Search Query");
        expect(parts.at(-1)).toEqual(
          expect.objectContaining({
            data: expect.objectContaining({
              input: expect.not.objectContaining({
                queries: expect.anything(),
              }),
            }),
          })
        );
      })
  );

  it.live("uses the server locale instead of the model-provided locale", () =>
    Effect.gen(function* () {
      const { parts, writer } = createWriter();
      const output = yield* search({
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
    })
  );

  it.live("preserves model-selected section filters", () =>
    Effect.gen(function* () {
      const { parts, writer } = createWriter();
      const output = yield* search({
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
      );

      expect(output.text).toContain("Artikel Politik");
      expect(parts.at(0)).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            input: expect.objectContaining({ section: "articles" }),
          }),
        })
      );
    })
  );

  it.live("preserves alternate query variants for one section", () =>
    Effect.gen(function* () {
      const { parts, writer } = createWriter();
      const capturedQueries: string[][] = [];
      const output = yield* search({
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
          search: (input) => {
            capturedQueries.push(input.queries ?? []);

            return Effect.succeed(
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
            );
          },
        })
      );

      expect(output.text).toContain("Hukum Kekekalan Massa");
      expect(output.text).toContain('- Query: "hukum kekekalan massa"');
      expect(output.result).toEqual(expect.objectContaining({ count: 1 }));
      expect(capturedQueries).toEqual([
        ["kimia kelas 10", "hukum kekekalan massa", "stoikiometri"],
      ]);
      expect(
        getSearchParts(parts)
          .filter((part) => part.status === "loading")
          .map((part) => part.input.queries)
      ).toEqual([["kimia kelas 10", "hukum kekekalan massa", "stoikiometri"]]);
      expect(
        getSearchParts(parts)
          .filter((part) => part.status === "done")
          .map((part) => part.input.queries)
      ).toEqual([["kimia kelas 10", "hukum kekekalan massa", "stoikiometri"]]);
    })
  );

  it.live("executes the model-provided try-out query unchanged", () =>
    Effect.gen(function* () {
      const { parts, writer } = createWriter();
      const capturedQueries: string[][] = [];

      yield* search({
        input: {
          limit: 10,
          locale: "id",
          offset: 0,
          queries: ["SNBT Pengetahuan Kuantitatif try out 2026 set 2"],
          section: "tryout",
        },
        locale: "id",
        toolCallId: "search-tryout-set",
        writer,
      }).pipe(
        Effect.provideService(NakafaSearch, {
          /** Captures the exact try-out query and returns the matching section row. */
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
                      "try-out/indonesia/snbt/2027/set-2/pengetahuan-kuantitatif",
                    section: "tryout",
                    sectionKey: "quantitative-knowledge",
                    setKey: "set-2",
                    title: "SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2",
                  }),
                ],
                limit: input.limit,
                offset: input.offset,
              })
            );
          },
        })
      );

      expect(capturedQueries).toEqual([
        ["SNBT Pengetahuan Kuantitatif try out 2026 set 2"],
      ]);
      expect(
        getSearchParts(parts)
          .filter((part) => part.status === "loading")
          .map((part) => part.input.queries)
      ).toEqual([["SNBT Pengetahuan Kuantitatif try out 2026 set 2"]]);
    })
  );
});

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { searchNakafaContent } from "@repo/backend/agent/search";
import type { Hit } from "@repo/backend/confect/contents/sections/hits.spec";
import { searchSections } from "@repo/backend/confect/contents/sections/search";
import { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import { findContent } from "@repo/backend/confect/nina/nakafa/find";
import { runSpecialist } from "@repo/backend/test/nina/specialist";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/test/fixture";
import { Array as Arr, Effect, Logger, MutableRef } from "effect";

vi.mock("@repo/backend/agent/search", () => ({ searchNakafaContent: vi.fn() }));
vi.mock("@repo/backend/confect/contents/sections/search", () => ({
  searchSections: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

/** A section hit of the lesson at a route, in the language of the fixture. */
function hit(
  route: string,
  anchor: string,
  headingPath: readonly string[],
  ordinal = 1,
  section: "material" | "quran" = "material"
): Hit {
  return {
    anchor,
    appLocale: "id",
    contentKey: `key/${route}`,
    excerpt: `Isi ${anchor}.`,
    headingPath,
    ordinal,
    reference: {
      ...readNakafaContentRefFixture("id", route, section),
      description: `Deskripsi ${route}`,
      title: `Judul ${route}`,
    },
  };
}

const input = {
  limit: 10,
  locale: "id",
  offset: 0,
  queries: ["matriks"],
} satisfies Parameters<typeof findContent>[0];
const wordResult = {
  count: 0,
  has_more: false,
  items: [],
  limit: 10,
  offset: 0,
};
const tryoutQuery = {
  limit: 10,
  locale: "id",
  offset: 0,
  queries: ["matriks"],
  section: "tryout",
};

/** A try-out that the word search found: a catalog entry, with no section to read. */
function tryout(route: string) {
  return {
    ...readNakafaContentRefFixture("id", route, "tryout"),
    description: `Deskripsi ${route}`,
    excerpt: `Simulasi ${route}.`,
    title: `Judul ${route}`,
  };
}

// A search over all kinds of content also looks for try-outs, which only the
// word search finds. Most tests find none.
beforeEach(() => {
  vi.mocked(searchNakafaContent).mockReturnValue(Effect.succeed(wordResult));
});

/** Runs the search and collects the log lines it writes, with the failure a line names. */
async function find(facts: Parameters<typeof findContent>[0]) {
  const logged = MutableRef.make<readonly string[]>([]);
  const found = await runSpecialist(() =>
    findContent(facts).pipe(
      Effect.provide(
        Logger.layer([
          Logger.formatStructured.pipe(
            Logger.map(({ annotations, level, message }) =>
              MutableRef.update(
                logged,
                Arr.append(
                  annotations.failure === undefined
                    ? `${level}: ${message}`
                    : `${level}: ${message} (${String(annotations.failure)})`
                )
              )
            )
          ),
        ])
      )
    )
  );
  return { found, logged: MutableRef.get(logged) };
}

describe("Nakafa content search", () => {
  it("finds the sections that answer a question and tells where to read each", async () => {
    vi.mocked(searchSections).mockReturnValue(
      Effect.succeed({
        hits: [
          hit("materi/matriks", "bentuk-matriks", ["Bentuk Matriks"]),
          hit("materi/vektor", "top", []),
          hit(
            "quran/36",
            "verse-1",
            ["Ya-Sin (surah 36)", "Verses 1-6"],
            0,
            "quran"
          ),
        ],
        kind: "hits",
      })
    );
    const { found, logged } = await find(input);
    expect(searchSections).toHaveBeenCalledExactlyOnceWith({
      limit: 20,
      locale: "id",
      query: "matriks",
    });
    expect(found.result).toMatchObject({
      count: 3,
      has_more: false,
      limit: 10,
      offset: 0,
    });
    expect(found.result.items[0]).toMatchObject({
      excerpt: "Bentuk Matriks: Isi bentuk-matriks.",
      title: "Judul materi/matriks",
    });
    expect(found.result.items[1]?.excerpt).toBe("Isi top.");
    expect(found.text).toContain("# Nakafa Search Query");
    expect(found.text).toContain("- Title: Judul materi/matriks");
    expect(found.text).toContain(
      Arr.join(
        [
          "# Matching Sections",
          "- Result 1: Bentuk Matriks (read section: bentuk-matriks)",
          "- Result 2: the start of the document",
          "- Result 3: Ya-Sin (surah 36) > Verses 1-6 (read section: verse-1)",
        ],
        "\n"
      )
    );
    expect(searchNakafaContent).toHaveBeenCalledExactlyOnceWith(tryoutQuery);
    expect(logged).toEqual([]);
  });

  it("adds the try-outs that the words find to the sections, ranked among them", async () => {
    vi.mocked(searchSections).mockReturnValue(
      Effect.succeed({
        hits: [
          hit("materi/matriks", "bentuk-matriks", ["Bentuk Matriks"]),
          hit("materi/vektor", "top", [], 0),
        ],
        kind: "hits",
      })
    );
    vi.mocked(searchNakafaContent).mockReturnValue(
      Effect.succeed({
        ...wordResult,
        count: 2,
        items: [tryout("tryout/utbk-matriks"), tryout("tryout/snbt-vektor")],
      })
    );
    const { found } = await find(input);
    expect(Arr.map(found.result.items, ({ title }) => title)).toEqual([
      "Judul materi/matriks",
      "Judul tryout/utbk-matriks",
      "Judul materi/vektor",
      "Judul tryout/snbt-vektor",
    ]);
    expect(found.result.items[1]).toMatchObject({
      excerpt: "Simulasi tryout/utbk-matriks.",
      section: "tryout",
    });
    expect(found.text).toContain(
      Arr.join(
        [
          "# Matching Sections",
          "- Result 1: Bentuk Matriks (read section: bentuk-matriks)",
          "- Result 2: the start of the document",
          "- Result 3: the start of the document",
          "- Result 4: the start of the document",
        ],
        "\n"
      )
    );
  });

  it("shows a try-out that the words find when no section answers", async () => {
    vi.mocked(searchSections).mockReturnValue(
      Effect.succeed({ hits: [], kind: "hits" })
    );
    vi.mocked(searchNakafaContent).mockReturnValue(
      Effect.succeed({
        ...wordResult,
        count: 1,
        items: [tryout("tryout/utbk-matriks")],
      })
    );
    const { found } = await find(input);
    expect(Arr.map(found.result.items, ({ title }) => title)).toEqual([
      "Judul tryout/utbk-matriks",
    ]);
  });

  it("searches each question and keeps the best section of each document once", async () => {
    vi.mocked(searchSections).mockImplementation(({ query }) =>
      Effect.succeed({
        hits:
          query === "matriks"
            ? [
                hit("materi/matriks", "determinan", ["Determinan"], 2),
                hit("materi/vektor", "top", [], 0),
              ]
            : [
                hit("materi/matriks", "top", [], 0),
                hit("materi/matriks", "determinan", ["Determinan"], 2),
              ],
        kind: "hits",
      })
    );
    const { found } = await find({
      ...input,
      queries: ["matriks", "determinan"],
      section: "material",
    });
    expect(searchSections).toHaveBeenCalledTimes(2);
    expect(searchSections).toHaveBeenCalledWith(
      expect.objectContaining({ query: "determinan", section: "material" })
    );
    // Asking for lessons does not look for try-outs.
    expect(searchNakafaContent).not.toHaveBeenCalled();
    expect(Arr.map(found.result.items, ({ title }) => title)).toEqual([
      "Judul materi/matriks",
      "Judul materi/vektor",
    ]);
    expect(found.text).toContain(
      "- Result 1: Determinan (read section: determinan)"
    );
  });

  it("pages the sections it found", async () => {
    vi.mocked(searchSections).mockReturnValue(
      Effect.succeed({
        hits: Arr.makeBy(5, (index) =>
          hit(`materi/bab-${index}`, "top", [], 0)
        ),
        kind: "hits",
      })
    );
    const { found } = await find({ ...input, limit: 2, offset: 1 });
    expect(found.result).toMatchObject({
      count: 2,
      has_more: true,
      limit: 2,
      next_offset: 3,
      offset: 1,
    });
    expect(Arr.map(found.result.items, ({ title }) => title)).toEqual([
      "Judul materi/bab-1",
      "Judul materi/bab-2",
    ]);
    const last = await find({ ...input, limit: 2, offset: 4 });
    expect(last.found.result).toMatchObject({ count: 1, has_more: false });
    expect(last.found.result).not.toHaveProperty("next_offset");
  });

  it("uses the questions that found sections when others found none", async () => {
    vi.mocked(searchSections).mockImplementation(({ query }) =>
      Effect.succeed(
        query === "kosong"
          ? { kind: "empty" }
          : { hits: [hit("materi/matriks", "top", [], 0)], kind: "hits" }
      )
    );
    const { found } = await find({ ...input, queries: ["kosong", "matriks"] });
    expect(found.result.items).toHaveLength(1);
  });

  it("searches by words when the index gives no answer, and says so", async () => {
    vi.mocked(searchSections).mockReturnValue(
      Effect.succeed({ kind: "empty" })
    );
    const { found, logged } = await find(input);
    expect(found.result).toEqual(wordResult);
    expect(found.text).toContain('- Query: "matriks"');
    expect(logged).toEqual([
      "INFO: The section index gave no answer; using the word search.",
    ]);
  });

  it("searches by words when the search for try-outs fails, and says so", async () => {
    vi.mocked(searchSections).mockReturnValue(
      Effect.succeed({
        hits: [hit("materi/matriks", "top", [], 0)],
        kind: "hits",
      })
    );
    vi.mocked(searchNakafaContent).mockReturnValueOnce(
      Effect.fail(new NakafaAgentDataReadError({ message: "Search failed." }))
    );
    const { found, logged } = await find(input);
    expect(found.result).toEqual(wordResult);
    expect(logged).toEqual([
      "WARN: The section search failed; using the word search. (NakafaAgentDataReadError)",
    ]);
  });

  it("searches by words when the section search fails, and says so", async () => {
    vi.mocked(searchSections).mockReturnValue(
      Effect.fail(new GatewayFailure({ reason: "timeout" }))
    );
    vi.mocked(searchNakafaContent).mockReturnValue(Effect.succeed(wordResult));
    const { found, logged } = await find(input);
    expect(found.result).toEqual(wordResult);
    expect(logged).toEqual([
      "WARN: The section search failed; using the word search. (GatewayFailure)",
    ]);
  });

  it("searches by words when the vector search breaks, which it reports as a defect", async () => {
    vi.mocked(searchSections).mockReturnValue(Effect.die("index unavailable"));
    vi.mocked(searchNakafaContent).mockReturnValue(Effect.succeed(wordResult));
    const { found, logged } = await find(input);
    expect(found.result).toEqual(wordResult);
    expect(logged).toEqual([
      "WARN: The section search failed; using the word search. (defect)",
    ]);
  });

  it.each([
    ["a try-out search", { ...input, section: "tryout" }],
    ["a search with no question", { limit: 10, locale: "id", offset: 0 }],
  ] satisfies [string, Parameters<typeof findContent>[0]][])(
    "searches %s by words only",
    async (_name, facts) => {
      vi.mocked(searchNakafaContent).mockReturnValue(
        Effect.succeed(wordResult)
      );
      const { found } = await find(facts);
      expect(found.result).toEqual(wordResult);
      expect(searchSections).not.toHaveBeenCalled();
    }
  );

  it("reports a failure of the word search", async () => {
    vi.mocked(searchNakafaContent).mockReturnValue(
      Effect.fail(new NakafaAgentDataReadError({ message: "Search failed." }))
    );
    await expect(
      find({ limit: 10, locale: "id", offset: 0 })
    ).rejects.toMatchObject({ message: "Search failed." });
  });
});

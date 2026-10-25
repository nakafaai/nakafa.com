import { RegisteredConvexFunction } from "@confect/server";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { readSurah } from "@repo/backend/confect/contents/sections/quran";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import { provider } from "@repo/backend/test/gateway";
import {
  embedWhileAnotherReleaseActivates,
  embedWithKnowledge,
  knowledgeBuild,
} from "@repo/backend/test/knowledge";
import { makeQuranChunk, makeQuranSurah } from "@repo/backend/test/quran/rows";
import {
  activateQuranSnapshot,
  activateQuranSource,
} from "@repo/backend/test/quran/snapshot";
import { Array as Arr, Effect, Option } from "effect";

function setup() {
  const t = createConvexTestWithBetterAuth();
  const read = (input: Parameters<typeof readSurah>[0]) =>
    t.mutation((ctx) =>
      Effect.runPromise(
        readSurah(input).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
  /** Records that the index holds the documents of the given surahs, at the version of the given read. */
  const hold = (surahs: readonly number[], version: string) =>
    t.mutation(async (ctx) => {
      for (const surah of surahs) {
        for (const appLocale of ACTIVE_APP_LOCALE_CODES) {
          await ctx.db.insert("contentSectionSources", {
            appLocale,
            contentKey: `quran/${surah}`,
            section: "quran",
            version,
          });
        }
      }
    });
  return { hold, read, t };
}

/** The first two surahs of the Quran, the first of seven verses in two chunks. */
const surahs = [
  makeQuranSurah(1, 7),
  makeQuranChunk({
    firstQuranNumber: 1,
    firstVerse: 1,
    surahNumber: 1,
    translationFootnotes: { en: "[1] Reviewed English note." },
    translationText: { en: "Praise be to God.[1]" },
    verseCount: 6,
  }),
  makeQuranChunk({
    firstQuranNumber: 7,
    firstVerse: 7,
    surahNumber: 1,
    verseCount: 1,
  }),
  makeQuranSurah(2, 6),
  makeQuranChunk({
    firstQuranNumber: 8,
    firstVerse: 1,
    surahNumber: 2,
    verseCount: 6,
  }),
];

describe("section Quran passages", () => {
  it("reads one document for each language, with one passage per signed chunk of verses", async () => {
    const { read, t } = setup();
    await t.mutation((ctx) => activateQuranSnapshot(ctx, surahs));
    const result = await read({ releaseId: TEST_RELEASE_ID, surah: 1 });
    if (result.kind !== "surah") {
      throw new Error("Expected the passages of the surah.");
    }
    expect(result).toMatchObject({
      releaseId: TEST_RELEASE_ID,
      surah: 1,
      unchanged: 0,
    });
    expect(
      Arr.map(result.documents, ({ appLocale, contentKey, section }) => [
        appLocale,
        contentKey,
        section,
      ])
    ).toEqual([
      ["en", "quran/1", "quran"],
      ["id", "quran/1", "quran"],
      ["de", "quran/1", "quran"],
    ]);
    expect(
      Arr.map(
        Arr.flatMap(result.documents, ({ sections }) => sections),
        ({ anchor, appLocale, count, ordinal }) =>
          `${appLocale} ${anchor} ${ordinal}/${count}`
      )
    ).toEqual([
      "en verse-1 0/2",
      "en verse-7 1/2",
      "id verse-1 0/2",
      "id verse-7 1/2",
      "de verse-1 0/2",
      "de verse-7 1/2",
    ]);
    const indonesian = Option.getOrThrow(
      Arr.findFirst(result.documents, ({ appLocale }) => appLocale === "id")
    );
    expect(indonesian.sections[0]).toMatchObject({
      contentKey: "quran/1",
      headingPath: ["Technical Surah 1 (surah 1)", "Verses 1-6"],
      publicPath: "quran/1",
      section: "quran",
    });
    expect(indonesian.sections[0]?.text).toBe(
      Arr.join(
        [
          "Technical Surah 1: Arti teknis 1",
          "Technical Surah 1 (surah 1) > Verses 1-6",
          "1. آية 1",
          "Terjemahan teknis 1",
          "Tafsir teknis 1",
          "2. آية 2",
          "Terjemahan teknis 2",
          "Tafsir teknis 2",
          "3. آية 3",
          "Terjemahan teknis 3",
          "Tafsir teknis 3",
          "4. آية 4",
          "Terjemahan teknis 4",
          "Tafsir teknis 4",
          "5. آية 5",
          "Terjemahan teknis 5",
          "Tafsir teknis 5",
          "6. آية 6",
          "Terjemahan teknis 6",
          "Tafsir teknis 6",
        ],
        "\n"
      )
    );
    const english = Option.getOrThrow(
      Arr.findFirst(result.documents, ({ appLocale }) => appLocale === "en")
    );
    const text = english.sections[0]?.text;
    expect(text).toContain("1. آية 1\nPraise be to God.\n2. آية 2");
    expect(text).not.toContain("Tafsir");
    expect(text).not.toContain("[1]");
    expect(text).not.toContain("Reviewed English note");
  });

  it("names the version of the documents by the snapshot of the Quran, the same for every surah and language", async () => {
    const { read, t } = setup();
    await t.mutation((ctx) => activateQuranSnapshot(ctx, surahs));
    const first = await read({ surah: 1 });
    const second = await read({ surah: 2 });
    if (first.kind !== "surah" || second.kind !== "surah") {
      throw new Error("Expected the passages of two surahs.");
    }
    const versions = Arr.dedupe(
      Arr.map(
        [...first.documents, ...second.documents],
        ({ version }) => version
      )
    );
    expect(versions).toHaveLength(1);
    expect(versions[0]).toContain("1:google/gemini-embedding-2:sha256:");
  });

  it("passes over the surahs whose documents the index holds at that version, and says how many documents it passed over", async () => {
    const { hold, read, t } = setup();
    await t.mutation((ctx) => activateQuranSnapshot(ctx, surahs));
    const first = await read({ surah: 1 });
    if (first.kind !== "surah") {
      throw new Error("Expected the passages of the surah.");
    }
    const [{ version }] = first.documents;
    await hold([1], version);
    const next = await read({ surah: 1 });
    expect(next).toMatchObject({
      kind: "surah",
      surah: 2,
      unchanged: ACTIVE_APP_LOCALE_CODES.length,
    });
  });

  it("reads a surah again when one of its languages lacks the version", async () => {
    const { read, t } = setup();
    await t.mutation((ctx) => activateQuranSnapshot(ctx, surahs));
    const first = await read({ surah: 1 });
    if (first.kind !== "surah") {
      throw new Error("Expected the passages of the surah.");
    }
    const [{ version }] = first.documents;
    await t.mutation((ctx) =>
      ctx.db.insert("contentSectionSources", {
        appLocale: "en",
        contentKey: "quran/1",
        section: "quran",
        version,
      })
    );
    expect(await read({ surah: 1 })).toMatchObject({
      kind: "surah",
      surah: 1,
      unchanged: 0,
    });
  });

  it("is done when the index holds every surah that is left", async () => {
    const { hold, read, t } = setup();
    await t.mutation((ctx) => activateQuranSnapshot(ctx, surahs));
    const first = await read({ surah: 1 });
    if (first.kind !== "surah") {
      throw new Error("Expected the passages of the surah.");
    }
    const [{ version }] = first.documents;
    await hold(Arr.range(3, QURAN_SURAH_COUNT), version);
    await hold([1, 2], version);
    expect(await read({ surah: 1 })).toEqual({
      kind: "done",
      releaseId: TEST_RELEASE_ID,
      unchanged: QURAN_SURAH_COUNT * ACTIVE_APP_LOCALE_CODES.length,
    });
    expect(await read({ surah: 3 })).toMatchObject({
      kind: "done",
      unchanged: (QURAN_SURAH_COUNT - 2) * ACTIVE_APP_LOCALE_CODES.length,
    });
  });

  it("is done when the active release has no Quran", async () => {
    const { read, t } = setup();
    await t.mutation(activateQuranSource);
    expect(await read({ surah: 1 })).toEqual({
      kind: "done",
      releaseId: TEST_RELEASE_ID,
      unchanged: 0,
    });
  });

  it("is stale when the build began for another release", async () => {
    const { read, t } = setup();
    await t.mutation(activateQuranSource);
    expect(await read({ releaseId: "release-earlier", surah: 1 })).toEqual({
      kind: "stale",
    });
  });

  it("is stale while no release is active", async () => {
    const { read } = setup();
    expect(await read({ surah: 1 })).toEqual({ kind: "stale" });
  });
});

describe("section build of the Quran", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => provider.embeddingModel.mockReset());

  /** A test deployment with the steps of the build and the rows that they store. */
  function building() {
    const t = createConvexTestWithBetterAuth();
    const rows = () =>
      t.query((ctx) => ctx.db.query("contentSections").collect());
    const sources = () =>
      t.query((ctx) => ctx.db.query("contentSectionSources").collect());
    return { ...knowledgeBuild(t), rows, sources, t };
  }

  it("indexes a surah at a time, with one request for each passage", async () => {
    const model = embedWithKnowledge();
    const { rows, run, sources, t } = building();
    const verses = 300;
    const chunk = 6;
    await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranSurah(2, verses),
        ...Arr.makeBy(verses / chunk, (index) =>
          makeQuranChunk({
            firstQuranNumber: index * chunk + 1,
            firstVerse: index * chunk + 1,
            surahNumber: 2,
            verseCount: chunk,
          })
        ),
      ])
    );
    const result = await run({
      position: { missing: 0, phase: "quran", surah: 2 },
      releaseId: TEST_RELEASE_ID,
    });
    const passages = (verses / chunk) * 3;
    expect(result).toMatchObject({
      embedded: passages,
      next: {
        position: { phase: "quran", surah: 3 },
        releaseId: TEST_RELEASE_ID,
      },
      skipped: 0,
      written: passages,
    });
    expect(model.doEmbedCalls).toHaveLength(passages);
    expect(await rows()).toHaveLength(passages);
    expect(await sources()).toHaveLength(3);
  });

  it("builds the active release when a manual start names no release", async () => {
    embedWithKnowledge();
    const { run, t } = building();
    await t.mutation(activateQuranSource);
    expect(
      await run({ position: { missing: 0, phase: "quran", surah: 1 } })
    ).toMatchObject({
      next: {
        position: { cursor: null, phase: "prune" },
        releaseId: TEST_RELEASE_ID,
      },
      stale: false,
    });
  });

  it("follows the last surah with the clean up", async () => {
    embedWithKnowledge();
    const { run, t } = building();
    await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranSurah(114, 6),
        makeQuranChunk({
          firstQuranNumber: 6231,
          firstVerse: 1,
          surahNumber: 114,
          verseCount: 6,
        }),
      ])
    );
    expect(
      await run({
        position: { missing: 0, phase: "quran", surah: 114 },
        releaseId: TEST_RELEASE_ID,
      })
    ).toMatchObject({
      next: {
        position: { cursor: null, phase: "prune" },
        releaseId: TEST_RELEASE_ID,
      },
    });
  });

  it("stores nothing and stops when another release becomes active while a surah is embedded", async () => {
    const { rows, run, sources, t } = building();
    await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranSurah(1, 6),
        makeQuranChunk({
          firstQuranNumber: 1,
          firstVerse: 1,
          surahNumber: 1,
          verseCount: 6,
        }),
      ])
    );
    embedWhileAnotherReleaseActivates(t);
    expect(
      await run({
        position: { missing: 0, phase: "quran", surah: 1 },
        releaseId: TEST_RELEASE_ID,
      })
    ).toMatchObject({ next: null, stale: true, written: 0 });
    expect(await rows()).toEqual([]);
    expect(await sources()).toEqual([]);
  });
});

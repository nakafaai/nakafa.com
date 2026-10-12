import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { readSurah } from "@repo/backend/confect/contents/sections/quran";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
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

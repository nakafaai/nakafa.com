import {
  QURAN_SURAH_COUNT,
  type QuranRuntimeVerse,
  type QuranSearchRow,
  type QuranSurahRow,
  QuranSurahRowSchema,
} from "@nakafa/aksara-contracts/quran/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { readQuranRow } from "@repo/backend/convex/contentRelease/quran/row";
import {
  quranLocaleValidator,
  quranSourceFields,
} from "@repo/backend/convex/contentRelease/quran/spec";
import {
  loadQuranSurah,
  readQuranSurahVerses,
} from "@repo/backend/convex/contentRelease/quran/surah";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

const quranViewNameValidator = v.object({
  translation: v.string(),
  transliteration: v.string(),
});

const quranViewSurahValidator = v.object({
  name: quranViewNameValidator,
  number: v.number(),
  numberOfVerses: v.number(),
});

const quranViewVerseValidator = v.object({
  arabic: v.string(),
  number: v.object({
    inQuran: v.number(),
    inSurah: v.number(),
  }),
  translation: v.string(),
});

/** Exact locale-specific Quran page projection returned to the web app. */
export const quranViewValidator = v.object({
  ...quranSourceFields,
  locale: quranLocaleValidator,
  nextSurah: v.union(quranViewSurahValidator, v.null()),
  previousSurah: v.union(quranViewSurahValidator, v.null()),
  surah: v.union(quranViewSurahValidator, v.null()),
  verses: v.array(quranViewVerseValidator),
});

type QuranView = Infer<typeof quranViewValidator>;
type QuranViewSurah = NonNullable<QuranView["surah"]>;
type QuranViewVerse = QuranView["verses"][number];

/** Reads one neighboring surah metadata row when that neighbor exists. */
const readNeighbor = Effect.fn("contentRelease.readQuranNeighbor")(function* (
  ctx: QueryCtx,
  snapshotId: string,
  surahNumber: number
) {
  if (surahNumber < 1 || surahNumber > QURAN_SURAH_COUNT) {
    return null;
  }
  return yield* readQuranRow(
    ctx,
    snapshotId,
    `surah:${surahNumber}`,
    QuranSurahRowSchema
  );
});

/** Projects only the signed surah metadata needed by the Quran page. */
function projectSurah(surah: QuranSurahRow): QuranViewSurah {
  return {
    name: {
      translation: surah.name.translation,
      transliteration: surah.name.transliteration,
    },
    number: surah.number,
    numberOfVerses: surah.numberOfVerses,
  };
}

/** Projects one verse without transporting unrelated locale or tafsir fields. */
function projectVerse(
  verse: QuranRuntimeVerse,
  locale: QuranSearchRow["locale"]
): QuranViewVerse {
  return {
    arabic: verse.text.arabic,
    number: verse.number,
    translation: verse.translation[locale].text,
  };
}

/** Returns the narrow locale-specific projection used by the Quran web UI. */
export const readQuranView = Effect.fn("contentRelease.readQuranView")(
  function* (
    ctx: QueryCtx,
    locale: QuranSearchRow["locale"],
    sourceSurah: number
  ) {
    const loaded = yield* loadQuranSurah(ctx, sourceSurah);
    if (loaded.surah === null || loaded.owner.snapshotId === null) {
      return {
        ...loaded.owner,
        locale,
        nextSurah: null,
        previousSurah: null,
        surah: null,
        verses: [],
      };
    }

    const { nextRow, previousRow, verses } = yield* Effect.all(
      {
        nextRow: readNeighbor(
          ctx,
          loaded.owner.snapshotId,
          loaded.surah.surahNumber + 1
        ),
        previousRow: readNeighbor(
          ctx,
          loaded.owner.snapshotId,
          loaded.surah.surahNumber - 1
        ),
        verses: readQuranSurahVerses(
          ctx,
          loaded.owner.snapshotId,
          loaded.surah.surahNumber,
          loaded.surah.row.payload.numberOfVerses
        ),
      },
      { concurrency: "unbounded" }
    );
    const nextSurah = nextRow ? projectSurah(nextRow.payload) : null;
    const previousSurah = previousRow
      ? projectSurah(previousRow.payload)
      : null;
    const surah = projectSurah(loaded.surah.row.payload);

    return {
      ...loaded.owner,
      locale,
      nextSurah,
      previousSurah,
      surah,
      verses: verses.map((verse) => projectVerse(verse, locale)),
    };
  }
);

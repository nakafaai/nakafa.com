import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import {
  QURAN_SURAH_COUNT,
  type QuranSurahRow,
  QuranSurahRowSchema,
} from "@nakafa/aksara-contracts/quran/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { readQuranRow } from "@repo/backend/convex/contentRelease/quran/row";
import {
  quranAppLocaleValidator,
  quranSourceFields,
} from "@repo/backend/convex/contentRelease/quran/spec";
import {
  loadQuranSurah,
  readQuranSurahVerses,
} from "@repo/backend/convex/contentRelease/quran/surah";
import { readQuranTranslation } from "@repo/backend/convex/contentRelease/quran/translation";
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

/** Exact app-locale Quran page projection returned to the web app. */
export const quranViewValidator = v.object({
  ...quranSourceFields,
  appLocale: quranAppLocaleValidator,
  nextSurah: v.union(quranViewSurahValidator, v.null()),
  previousSurah: v.union(quranViewSurahValidator, v.null()),
  surah: v.union(quranViewSurahValidator, v.null()),
  verses: v.array(quranViewVerseValidator),
});

type QuranView = Infer<typeof quranViewValidator>;
type QuranViewSurah = NonNullable<QuranView["surah"]>;

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

/** Projects one verse without transporting other locales or tafsir fields. */
const projectVerse = Effect.fn("contentRelease.projectQuranViewVerse")(
  function* (verse: QuranRuntimeVerse, appLocale: AppLocaleCode) {
    const translation = yield* readQuranTranslation(verse, appLocale);
    return {
      arabic: verse.text.arabic,
      number: verse.number,
      translation: translation.text,
    };
  }
);

/** Returns the narrow app-locale projection used by the Quran web UI. */
export const readQuranView = Effect.fn("contentRelease.readQuranView")(
  function* (ctx: QueryCtx, appLocale: AppLocaleCode, sourceSurah: number) {
    const loaded = yield* loadQuranSurah(ctx, sourceSurah);
    if (loaded.surah === null || loaded.owner.snapshotId === null) {
      return {
        ...loaded.owner,
        appLocale,
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
    const projectedVerses = yield* Effect.forEach(verses, (verse) =>
      projectVerse(verse, appLocale)
    );

    return {
      ...loaded.owner,
      appLocale,
      nextSurah,
      previousSurah,
      surah,
      verses: projectedVerses,
    };
  }
);

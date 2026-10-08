import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import { readQuranTranslationDocument } from "@repo/backend/confect/contentRelease/quran/translation";
import { separateQuranBismillah } from "@repo/backend/content/quran/bismillah";
import type { PublishedQuranSurah } from "@repo/backend/content/quran/contract";
import {
  readQuranBismillah,
  verifyQuranBismillah,
} from "@repo/backend/content/quran/preface";
import type { QuranView } from "@repo/backend/content/quran/response";
import { readQuranLocaleSources } from "@repo/backend/content/quran/sources";
import {
  loadQuranSurah,
  readQuranSurahRow,
  readQuranSurahVerses,
} from "@repo/backend/content/quran/surah";
import { Effect } from "effect";

type QuranViewSurah = NonNullable<QuranView["surah"]>;

/** Reads one neighboring surah metadata row when that neighbor exists. */
const readNeighbor = Effect.fn("contentRelease.readQuranNeighbor")(function* (
  snapshotId: string,
  surahNumber: number
) {
  if (surahNumber < 1 || surahNumber > QURAN_SURAH_COUNT) {
    return null;
  }
  return yield* readQuranSurahRow(snapshotId, surahNumber);
});

/** Projects only the signed surah metadata needed by the Quran page. */
function projectSurah(surah: PublishedQuranSurah): QuranViewSurah {
  return {
    name: {
      arabic: surah.name.arabic,
      sourceMeaning: surah.name.meaning,
      transliteration: surah.name.transliteration,
    },
    number: surah.number,
    numberOfVerses: surah.numberOfVerses,
  };
}

/** Loads one source translation and its canonical semantic document. */
const loadVerse = Effect.fn("contentRelease.loadQuranViewVerse")(function* (
  verse: QuranRuntimeVerse,
  appLocale: AppLocaleCode
) {
  const { document, translation } = yield* readQuranTranslationDocument(
    verse,
    appLocale
  );
  return {
    arabic: verse.text.arabic,
    document,
    number: verse.number,
    translation,
  };
});

/** Loads the exact signed source fields for one canonical Quran page. */
const loadQuranView = Effect.fn("contentRelease.loadQuranView")(function* (
  appLocale: AppLocaleCode,
  sourceSurah: number
) {
  const loaded = yield* loadQuranSurah(sourceSurah);
  if (loaded.surah === null || loaded.owner.snapshotId === null) {
    return {
      ...loaded.owner,
      appLocale,
      nextSurah: null,
      bismillah: null,
      previousSurah: null,
      sources: null,
      surah: null,
      tafsirAccess: null,
      verses: [],
    };
  }
  const { bismillah, localeSources, nextRow, previousRow, verses } =
    yield* Effect.all(
      {
        bismillah: readQuranBismillah(
          loaded.owner.snapshotId,
          appLocale,
          loaded.surah.surahNumber,
          1
        ),
        localeSources: readQuranLocaleSources(
          loaded.owner.snapshotId,
          appLocale
        ),
        nextRow: readNeighbor(
          loaded.owner.snapshotId,
          loaded.surah.surahNumber + 1
        ),
        previousRow: readNeighbor(
          loaded.owner.snapshotId,
          loaded.surah.surahNumber - 1
        ),
        verses: readQuranSurahVerses(
          loaded.owner.snapshotId,
          loaded.surah.surahNumber,
          loaded.surah.row.payload.numberOfVerses
        ),
      },
      {
        concurrency: "unbounded",
      }
    );
  const loadedVerses = yield* Effect.forEach(verses, (verse) =>
    loadVerse(verse, appLocale)
  );
  return {
    ...loaded.owner,
    appLocale,
    bismillah,
    nextSurah: nextRow?.payload ?? null,
    previousSurah: previousRow?.payload ?? null,
    sources: localeSources.sources,
    surah: loaded.surah.row.payload,
    tafsirAccess: localeSources.tafsirAccess,
    verses: loadedVerses,
  };
});

/** Returns the canonical web projection without compatibility aliases. */
export const readQuranView = Effect.fn("contentRelease.readQuranView")(
  function* (appLocale: AppLocaleCode, sourceSurah: number) {
    const loaded = yield* loadQuranView(appLocale, sourceSurah);
    const { bismillah, ...view } = loaded;
    const projected = separateQuranBismillah(bismillah, loaded.verses);
    yield* verifyQuranBismillah(bismillah, projected.preBismillah);
    return {
      ...view,
      nextSurah:
        loaded.nextSurah === null ? null : projectSurah(loaded.nextSurah),
      previousSurah:
        loaded.previousSurah === null
          ? null
          : projectSurah(loaded.previousSurah),
      preBismillah: projected.preBismillah,
      surah: loaded.surah === null ? null : projectSurah(loaded.surah),
      verses: projected.verses.map(({ arabic, document, number }) => ({
        arabic,
        number,
        translation: document,
      })),
    };
  }
);

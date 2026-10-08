import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { readQuranTranslationDocument } from "@repo/backend/confect/contentRelease/quran/translation";
import { separateQuranBismillah } from "@repo/backend/content/quran/bismillah";
import type { PublishedQuranSurah } from "@repo/backend/content/quran/contract";
import {
  readQuranBismillah,
  verifyQuranBismillah,
} from "@repo/backend/content/quran/preface";
import type { quranDocumentValidator } from "@repo/backend/content/quran/response";
import { readQuranLocaleSources } from "@repo/backend/content/quran/sources";
import {
  loadQuranSurah,
  readQuranSurahVerses,
} from "@repo/backend/content/quran/surah";
import { Effect } from "effect";

type QuranDocument = typeof quranDocumentValidator.Type;
type QuranDocumentSurah = NonNullable<QuranDocument["surah"]>;

/** Projects complete public surah metadata without signed envelope fields. */
function projectSurah(surah: PublishedQuranSurah): QuranDocumentSurah {
  return {
    kind: surah.kind,
    name: {
      arabic: surah.name.arabic,
      sourceMeaning: surah.name.meaning,
      transliteration: surah.name.transliteration,
    },
    number: surah.number,
    numberOfVerses: surah.numberOfVerses,
    revelation: surah.revelation,
  };
}

/** Loads one exact source translation and its canonical semantic document. */
const loadVerse = Effect.fn("contentRelease.loadQuranDocumentVerse")(function* (
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

/** Loads the exact signed source fields for one canonical document. */
const loadQuranDocument = Effect.fn("contentRelease.loadQuranDocument")(
  function* (appLocale: AppLocaleCode, sourceSurah: number) {
    const loaded = yield* loadQuranSurah(sourceSurah);
    if (loaded.surah === null || loaded.owner.snapshotId === null) {
      return {
        ...loaded.owner,
        appLocale,
        bismillah: null,
        sources: null,
        surah: null,
        tafsirAccess: null,
        verses: [],
      };
    }
    const { bismillah, localeSources, verses } = yield* Effect.all(
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
      sources: localeSources.sources,
      surah: loaded.surah.row.payload,
      tafsirAccess: localeSources.tafsirAccess,
      verses: loadedVerses,
    };
  }
);

/** Returns the canonical Quran document without compatibility aliases. */
export const readQuranDocument = Effect.fn("contentRelease.readQuranDocument")(
  function* (appLocale: AppLocaleCode, sourceSurah: number) {
    const loaded = yield* loadQuranDocument(appLocale, sourceSurah);
    const { bismillah, ...document } = loaded;
    const projected = separateQuranBismillah(bismillah, loaded.verses);
    yield* verifyQuranBismillah(bismillah, projected.preBismillah);
    return {
      ...document,
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

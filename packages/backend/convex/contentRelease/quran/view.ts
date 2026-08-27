import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import {
  QURAN_SURAH_COUNT,
  type QuranSurahRow,
} from "@nakafa/aksara-contracts/quran/spec";
import { separateQuranBismillah } from "@repo/backend/content/quran/bismillah";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  quranBismillahValidator,
  readQuranBismillah,
  verifyQuranBismillah,
} from "@repo/backend/convex/contentRelease/quran/bismillah";
import { readQuranLocaleSources } from "@repo/backend/convex/contentRelease/quran/sources";
import {
  quranAppLocaleValidator,
  quranReadingSourcesValidator,
  quranSourceFields,
  quranTafsirAccessValidator,
  quranTranslationDocumentValidator,
} from "@repo/backend/convex/contentRelease/quran/spec";
import {
  loadQuranSurah,
  readQuranSurahRow,
  readQuranSurahVerses,
} from "@repo/backend/convex/contentRelease/quran/surah";
import { readQuranTranslationDocument } from "@repo/backend/convex/contentRelease/quran/translation";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

const quranViewNameValidator = v.object({
  meaning: v.union(v.string(), v.null()),
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
  translation: quranTranslationDocumentValidator,
});

/** Exact app-locale Quran page projection returned to the web app. */
export const quranViewValidator = v.object({
  ...quranSourceFields,
  appLocale: quranAppLocaleValidator,
  nextSurah: v.union(quranViewSurahValidator, v.null()),
  previousSurah: v.union(quranViewSurahValidator, v.null()),
  sources: v.union(quranReadingSourcesValidator, v.null()),
  surah: v.union(quranViewSurahValidator, v.null()),
  tafsirAccess: v.union(quranTafsirAccessValidator, v.null()),
  verses: v.array(quranViewVerseValidator),
});

/** Bismillah-aware Quran page introduced before consumers switch. */
export const quranPageValidator = v.object({
  ...quranViewValidator.fields,
  preBismillah: v.union(quranBismillahValidator, v.null()),
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
  return yield* readQuranSurahRow(ctx, snapshotId, surahNumber);
});

/** Projects only the signed surah metadata needed by the Quran page. */
function projectSurah(
  surah: QuranSurahRow,
  appLocale: AppLocaleCode
): QuranViewSurah {
  return {
    name: {
      meaning:
        surah.name.meaning.appLocale === appLocale
          ? surah.name.meaning.text
          : null,
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

/** Loads the exact signed source fields shared by V1 and V2 views. */
export const loadQuranView = Effect.fn("contentRelease.loadQuranView")(
  function* (ctx: QueryCtx, appLocale: AppLocaleCode, sourceSurah: number) {
    const loaded = yield* loadQuranSurah(ctx, sourceSurah);
    if (loaded.surah === null || loaded.owner.snapshotId === null) {
      return {
        ...loaded.owner,
        appLocale,
        nextSurah: null,
        previousSurah: null,
        sources: null,
        surah: null,
        tafsirAccess: null,
        verses: [],
      };
    }

    const { localeSources, nextRow, previousRow, verses } = yield* Effect.all(
      {
        localeSources: readQuranLocaleSources(
          ctx,
          loaded.owner.snapshotId,
          appLocale
        ),
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
    const loadedVerses = yield* Effect.forEach(verses, (verse) =>
      loadVerse(verse, appLocale)
    );

    return {
      ...loaded.owner,
      appLocale,
      nextSurah: nextRow?.payload ?? null,
      previousSurah: previousRow?.payload ?? null,
      sources: localeSources.sources,
      surah: loaded.surah.row.payload,
      tafsirAccess: localeSources.tafsirAccess,
      verses: loadedVerses,
    };
  }
);

/** Returns the canonical V2 web projection without predecessor aliases. */
export const readQuranView = Effect.fn("contentRelease.readQuranView")(
  function* (ctx: QueryCtx, appLocale: AppLocaleCode, sourceSurah: number) {
    const loaded = yield* loadQuranView(ctx, appLocale, sourceSurah);
    return {
      ...loaded,
      nextSurah:
        loaded.nextSurah === null
          ? null
          : projectSurah(loaded.nextSurah, appLocale),
      previousSurah:
        loaded.previousSurah === null
          ? null
          : projectSurah(loaded.previousSurah, appLocale),
      surah:
        loaded.surah === null ? null : projectSurah(loaded.surah, appLocale),
      verses: loaded.verses.map(({ arabic, document, number }) => ({
        arabic,
        number,
        translation: document,
      })),
    };
  }
);

/** Returns the Bismillah-aware Quran page without changing prior contracts. */
export const readQuranPage = Effect.fn("contentRelease.readQuranPage")(
  function* (ctx: QueryCtx, appLocale: AppLocaleCode, sourceSurah: number) {
    const loaded = yield* loadQuranView(ctx, appLocale, sourceSurah);
    const bismillah =
      loaded.snapshotId === null
        ? null
        : yield* readQuranBismillah(
            ctx,
            loaded.snapshotId,
            appLocale,
            sourceSurah,
            1
          );
    const projected = separateQuranBismillah(bismillah, loaded.verses);
    yield* verifyQuranBismillah(bismillah, projected.preBismillah);
    return {
      ...loaded,
      nextSurah:
        loaded.nextSurah === null
          ? null
          : projectSurah(loaded.nextSurah, appLocale),
      preBismillah: projected.preBismillah,
      previousSurah:
        loaded.previousSurah === null
          ? null
          : projectSurah(loaded.previousSurah, appLocale),
      surah:
        loaded.surah === null ? null : projectSurah(loaded.surah, appLocale),
      verses: projected.verses.map(({ arabic, document, number }) => ({
        arabic,
        number,
        translation: document,
      })),
    };
  }
);

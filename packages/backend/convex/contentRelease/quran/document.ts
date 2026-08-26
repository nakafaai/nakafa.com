import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import type { QuranSurahRow } from "@nakafa/aksara-contracts/quran/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { readQuranLocaleSources } from "@repo/backend/convex/contentRelease/quran/sources";
import {
  quranAppLocaleValidator,
  quranReadingSourcesValidator,
  quranRevelationPlaceValidator,
  quranSourceFields,
  quranTafsirAccessValidator,
  quranTranslationDocumentValidator,
} from "@repo/backend/convex/contentRelease/quran/spec";
import {
  loadQuranSurah,
  readQuranSurahVerses,
} from "@repo/backend/convex/contentRelease/quran/surah";
import { readQuranTranslationDocument } from "@repo/backend/convex/contentRelease/quran/translation";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

const quranDocumentSurahValidator = v.object({
  kind: v.literal("quran-surah"),
  name: v.object({
    arabic: v.string(),
    meaning: v.union(v.string(), v.null()),
    transliteration: v.string(),
  }),
  number: v.number(),
  numberOfVerses: v.number(),
  revelation: v.object({
    order: v.number(),
    place: quranRevelationPlaceValidator,
  }),
});

const quranDocumentVerseValidator = v.object({
  arabic: v.string(),
  number: v.object({ inQuran: v.number(), inSurah: v.number() }),
  translation: quranTranslationDocumentValidator,
});

/** Exact app-locale Quran document returned to the public content API. */
export const quranDocumentValidator = v.object({
  ...quranSourceFields,
  appLocale: quranAppLocaleValidator,
  sources: v.union(quranReadingSourcesValidator, v.null()),
  surah: v.union(quranDocumentSurahValidator, v.null()),
  tafsirAccess: v.union(quranTafsirAccessValidator, v.null()),
  verses: v.array(quranDocumentVerseValidator),
});

type QuranDocument = Infer<typeof quranDocumentValidator>;
type QuranDocumentSurah = NonNullable<QuranDocument["surah"]>;

/** Projects complete public surah metadata without signed envelope fields. */
function projectSurah(
  surah: QuranSurahRow,
  appLocale: AppLocaleCode
): QuranDocumentSurah {
  return {
    kind: surah.kind,
    name: {
      arabic: surah.name.arabic,
      meaning:
        surah.name.meaning.appLocale === appLocale
          ? surah.name.meaning.text
          : null,
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

/** Loads the exact signed source fields shared by V1 and V2 projections. */
export const loadQuranDocument = Effect.fn("contentRelease.loadQuranDocument")(
  function* (ctx: QueryCtx, appLocale: AppLocaleCode, sourceSurah: number) {
    const loaded = yield* loadQuranSurah(ctx, sourceSurah);
    if (loaded.surah === null || loaded.owner.snapshotId === null) {
      return {
        ...loaded.owner,
        appLocale,
        sources: null,
        surah: null,
        tafsirAccess: null,
        verses: [],
      };
    }
    const { localeSources, verses } = yield* Effect.all(
      {
        localeSources: readQuranLocaleSources(
          ctx,
          loaded.owner.snapshotId,
          appLocale
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
      sources: localeSources.sources,
      surah: loaded.surah.row.payload,
      tafsirAccess: localeSources.tafsirAccess,
      verses: loadedVerses,
    };
  }
);

/** Returns the canonical V2 Quran document without predecessor aliases. */
export const readQuranDocument = Effect.fn("contentRelease.readQuranDocument")(
  function* (ctx: QueryCtx, appLocale: AppLocaleCode, sourceSurah: number) {
    const loaded = yield* loadQuranDocument(ctx, appLocale, sourceSurah);
    return {
      ...loaded,
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

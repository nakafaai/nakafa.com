import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import type { QuranSurahRow } from "@nakafa/aksara-contracts/quran/spec";
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
  quranRevelationPlaceValidator,
  quranSourceFields,
  quranSurahMeaningValidator,
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
    sourceMeaning: v.optional(quranSurahMeaningValidator),
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
  preBismillah: v.union(quranBismillahValidator, v.null()),
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
export const loadQuranDocument = Effect.fn("contentRelease.loadQuranDocument")(
  function* (ctx: QueryCtx, appLocale: AppLocaleCode, sourceSurah: number) {
    const loaded = yield* loadQuranSurah(ctx, sourceSurah);
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
          ctx,
          loaded.owner.snapshotId,
          appLocale,
          loaded.surah.surahNumber,
          1
        ),
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
  function* (ctx: QueryCtx, appLocale: AppLocaleCode, sourceSurah: number) {
    const loaded = yield* loadQuranDocument(ctx, appLocale, sourceSurah);
    const { bismillah, ...document } = loaded;
    const projected = separateQuranBismillah(bismillah, loaded.verses);
    yield* verifyQuranBismillah(bismillah, projected.preBismillah);
    return {
      ...document,
      preBismillah: projected.preBismillah,
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

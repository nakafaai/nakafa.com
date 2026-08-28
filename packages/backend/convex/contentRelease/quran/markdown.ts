import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import type { PublishedQuranSurah } from "@repo/backend/content/quran/contract";
import { separateQuranBismillah } from "@repo/backend/content/quran/bismillah";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
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
  readQuranSurahVersePrefix,
} from "@repo/backend/convex/contentRelease/quran/surah";
import { readQuranTranslationDocument } from "@repo/backend/convex/contentRelease/quran/translation";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

const quranMarkdownSurahValidator = v.object({
  name: v.object({
    sourceMeaning: quranSurahMeaningValidator,
    transliteration: v.string(),
  }),
  number: v.number(),
  numberOfVerses: v.number(),
  revelation: v.object({ place: quranRevelationPlaceValidator }),
});

const quranMarkdownVerseValidator = v.object({
  arabic: v.string(),
  number: v.object({ inSurah: v.number() }),
  translation: quranTranslationDocumentValidator,
});

/** Exact signed fields needed to render app-locale Quran markdown. */
export const quranMarkdownValidator = v.object({
  ...quranSourceFields,
  appLocale: quranAppLocaleValidator,
  preBismillah: v.union(quranBismillahValidator, v.null()),
  sources: v.union(quranReadingSourcesValidator, v.null()),
  surah: v.union(quranMarkdownSurahValidator, v.null()),
  tafsirAccess: v.union(quranTafsirAccessValidator, v.null()),
  toVerse: v.number(),
  verses: v.array(quranMarkdownVerseValidator),
});

export type QuranMarkdown = Infer<typeof quranMarkdownValidator>;
type QuranMarkdownSurah = NonNullable<QuranMarkdown["surah"]>;

/** Projects only metadata rendered by Quran markdown consumers. */
function projectSurah(surah: PublishedQuranSurah): QuranMarkdownSurah {
  return {
    name: {
      sourceMeaning: surah.name.meaning,
      transliteration: surah.name.transliteration,
    },
    number: surah.number,
    numberOfVerses: surah.numberOfVerses,
    revelation: { place: surah.revelation.place },
  };
}

/** Loads one source translation and its canonical semantic document. */
const loadVerse = Effect.fn("contentRelease.loadQuranMarkdownVerse")(function* (
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
    number: { inSurah: verse.number.inSurah },
    translation,
  };
});

/** Validates one optional positive verse limit from a markdown consumer. */
const validateVerseLimit = Effect.fn(
  "contentRelease.validateQuranMarkdownVerseLimit"
)(function* (verseLimit: number | undefined) {
  if (verseLimit === undefined) {
    return verseLimit;
  }
  if (!Number.isSafeInteger(verseLimit) || verseLimit < 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INVALID_REQUEST",
      "Quran markdown verse limit must be a positive integer."
    );
  }
  return verseLimit;
});

/** Loads the exact signed source fields for canonical Quran markdown. */
export const loadQuranMarkdown = Effect.fn("contentRelease.loadQuranMarkdown")(
  function* (
    ctx: QueryCtx,
    appLocale: AppLocaleCode,
    sourceSurah: number,
    sourceVerseLimit?: number
  ) {
    const verseLimit = yield* validateVerseLimit(sourceVerseLimit);
    const loaded = yield* loadQuranSurah(ctx, sourceSurah);
    if (loaded.surah === null || loaded.owner.snapshotId === null) {
      return {
        ...loaded.owner,
        appLocale,
        bismillah: null,
        sources: null,
        surah: null,
        tafsirAccess: null,
        toVerse: 0,
        verses: [],
      };
    }
    const numberOfVerses = loaded.surah.row.payload.numberOfVerses;
    const toVerse = Math.min(verseLimit ?? numberOfVerses, numberOfVerses);
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
        verses: readQuranSurahVersePrefix(
          ctx,
          loaded.owner.snapshotId,
          loaded.surah.surahNumber,
          numberOfVerses,
          toVerse
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
      toVerse,
      verses: loadedVerses,
    };
  }
);

/** Returns canonical markdown fields without compatibility aliases. */
export const readQuranMarkdown = Effect.fn("contentRelease.readQuranMarkdown")(
  function* (
    ctx: QueryCtx,
    appLocale: AppLocaleCode,
    sourceSurah: number,
    sourceVerseLimit?: number
  ) {
    const loaded = yield* loadQuranMarkdown(
      ctx,
      appLocale,
      sourceSurah,
      sourceVerseLimit
    );
    const { bismillah, ...markdown } = loaded;
    const projected = separateQuranBismillah(bismillah, loaded.verses);
    yield* verifyQuranBismillah(bismillah, projected.preBismillah);
    return {
      ...markdown,
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

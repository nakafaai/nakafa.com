import type {
  QuranRuntimeVerse,
  QuranSearchRow,
  QuranSurahRow,
} from "@nakafa/aksara-contracts/quran/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
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

const quranDocumentTranslationValidator = v.object({
  footnotes: v.string(),
  text: v.string(),
});

const quranDocumentSurahValidator = v.object({
  kind: v.literal("quran-surah"),
  name: v.object({
    arabic: v.string(),
    translation: v.string(),
    transliteration: v.string(),
  }),
  number: v.number(),
  numberOfVerses: v.number(),
  revelation: v.object({ order: v.number(), place: v.string() }),
});

const quranDocumentVerseValidator = v.object({
  arabic: v.string(),
  number: v.object({ inQuran: v.number(), inSurah: v.number() }),
  translation: quranDocumentTranslationValidator,
});

/** Exact locale-specific Quran document returned to the public content API. */
export const quranDocumentValidator = v.object({
  ...quranSourceFields,
  locale: quranLocaleValidator,
  surah: v.union(quranDocumentSurahValidator, v.null()),
  verses: v.array(quranDocumentVerseValidator),
});

type QuranDocument = Infer<typeof quranDocumentValidator>;
type QuranDocumentSurah = NonNullable<QuranDocument["surah"]>;
type QuranDocumentVerse = QuranDocument["verses"][number];

/** Projects complete public surah metadata without signed envelope fields. */
function projectSurah(surah: QuranSurahRow): QuranDocumentSurah {
  return {
    kind: surah.kind,
    name: surah.name,
    number: surah.number,
    numberOfVerses: surah.numberOfVerses,
    revelation: surah.revelation,
  };
}

/** Projects one API verse in the requested locale without tafsir or metadata. */
function projectVerse(
  verse: QuranRuntimeVerse,
  locale: QuranSearchRow["locale"]
): QuranDocumentVerse {
  return {
    arabic: verse.text.arabic,
    number: verse.number,
    translation: verse.translation[locale],
  };
}

/** Returns the narrow signed Quran document used by the public content API. */
export const readQuranDocument = Effect.fn("contentRelease.readQuranDocument")(
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
        surah: null,
        verses: [],
      };
    }
    const verses = yield* readQuranSurahVerses(
      ctx,
      loaded.owner.snapshotId,
      loaded.surah.surahNumber,
      loaded.surah.row.payload.numberOfVerses
    );

    return {
      ...loaded.owner,
      locale,
      surah: projectSurah(loaded.surah.row.payload),
      verses: verses.map((verse) => projectVerse(verse, locale)),
    };
  }
);

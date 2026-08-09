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

const quranMarkdownSurahValidator = v.object({
  name: v.object({
    translation: v.string(),
    transliteration: v.string(),
  }),
  number: v.number(),
  numberOfVerses: v.number(),
  revelation: v.object({ place: v.string() }),
});

const quranMarkdownVerseValidator = v.object({
  arabic: v.string(),
  number: v.object({ inSurah: v.number() }),
  translation: v.object({ footnotes: v.string(), text: v.string() }),
});

/** Exact signed fields needed to render locale-specific Quran markdown. */
export const quranMarkdownValidator = v.object({
  ...quranSourceFields,
  locale: quranLocaleValidator,
  surah: v.union(quranMarkdownSurahValidator, v.null()),
  verses: v.array(quranMarkdownVerseValidator),
});

type QuranMarkdown = Infer<typeof quranMarkdownValidator>;
type QuranMarkdownSurah = NonNullable<QuranMarkdown["surah"]>;
type QuranMarkdownVerse = QuranMarkdown["verses"][number];

/** Projects only metadata rendered by Quran markdown consumers. */
function projectSurah(surah: QuranSurahRow): QuranMarkdownSurah {
  return {
    name: {
      translation: surah.name.translation,
      transliteration: surah.name.transliteration,
    },
    number: surah.number,
    numberOfVerses: surah.numberOfVerses,
    revelation: { place: surah.revelation.place },
  };
}

/** Projects one localized markdown verse without multilingual or tafsir data. */
function projectVerse(
  verse: QuranRuntimeVerse,
  locale: QuranSearchRow["locale"]
): QuranMarkdownVerse {
  return {
    arabic: verse.text.arabic,
    number: { inSurah: verse.number.inSurah },
    translation: verse.translation[locale],
  };
}

/** Returns the narrow signed Quran projection used by markdown consumers. */
export const readQuranMarkdown = Effect.fn("contentRelease.readQuranMarkdown")(
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

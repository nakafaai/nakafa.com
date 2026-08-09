import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadQuranPassage } from "@repo/backend/convex/contentRelease/quran/reference";
import {
  quranSourceFields,
  quranTafsirLocaleValidator,
} from "@repo/backend/convex/contentRelease/quran/spec";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

/** Exact signed tafsir response returned only after one verse is requested. */
export const quranInterpretationValidator = v.object({
  ...quranSourceFields,
  interpretation: v.union(v.string(), v.null()),
  locale: quranTafsirLocaleValidator,
  surahNumber: v.number(),
  verseNumber: v.number(),
});

type QuranInterpretation = Infer<typeof quranInterpretationValidator>;

/** Reads one exact Indonesian tafsir from its verified immutable chunk. */
export const readQuranInterpretation = Effect.fn(
  "contentRelease.readQuranInterpretation"
)(function* (
  ctx: QueryCtx,
  locale: QuranInterpretation["locale"],
  expectedSnapshotId: string,
  sourceSurah: number,
  sourceVerse: number
) {
  const loaded = yield* loadQuranPassage(ctx, {
    expectedSnapshotId,
    fromVerse: sourceVerse,
    surahNumber: sourceSurah,
    toVerse: sourceVerse,
  });
  if (loaded.passage === null) {
    return {
      ...loaded.owner,
      interpretation: null,
      locale,
      surahNumber: loaded.input.surahNumber,
      verseNumber: loaded.input.fromVerse,
    };
  }

  const verse = loaded.passage.chunks.rows
    .flatMap((chunk) => chunk.verses)
    .find(({ number }) => number.inSurah === loaded.input.fromVerse);
  if (!verse) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Quran surah ${loaded.input.surahNumber} is missing verse ${loaded.input.fromVerse}.`
    );
  }

  return {
    ...loaded.owner,
    interpretation: verse.tafsir[locale].text,
    locale,
    surahNumber: loaded.input.surahNumber,
    verseNumber: loaded.input.fromVerse,
  };
});

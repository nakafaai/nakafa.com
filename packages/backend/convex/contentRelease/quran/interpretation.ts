import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadQuranPassage } from "@repo/backend/convex/contentRelease/quran/reference";
import { readQuranLocaleSources } from "@repo/backend/convex/contentRelease/quran/sources";
import {
  quranSourceFields,
  quranTafsirAccessValidator,
  quranTafsirAppLocaleValidator,
} from "@repo/backend/convex/contentRelease/quran/spec";
import { readQuranTafsir } from "@repo/backend/convex/contentRelease/quran/translation";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

/** Exact signed tafsir response returned only after one verse is requested. */
export const quranInterpretationValidator = v.object({
  ...quranSourceFields,
  appLocale: quranTafsirAppLocaleValidator,
  interpretation: v.union(v.string(), v.null()),
  surahNumber: v.number(),
  tafsirAccess: v.union(quranTafsirAccessValidator, v.null()),
  verseNumber: v.number(),
});

type QuranInterpretation = Infer<typeof quranInterpretationValidator>;

/** Reads one exact Indonesian tafsir from its verified immutable chunk. */
export const readQuranInterpretation = Effect.fn(
  "contentRelease.readQuranInterpretation"
)(function* (
  ctx: QueryCtx,
  appLocale: QuranInterpretation["appLocale"],
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
      appLocale,
      interpretation: null,
      surahNumber: loaded.input.surahNumber,
      tafsirAccess: null,
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

  const { tafsirAccess } = yield* readQuranLocaleSources(
    ctx,
    loaded.owner.snapshotId,
    appLocale
  );
  if (tafsirAccess?.kind !== "embedded") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Quran Tafsir source is unavailable for ${appLocale}.`
    );
  }
  const interpretation = yield* readQuranTafsir(verse, appLocale);
  return {
    ...loaded.owner,
    appLocale,
    interpretation: interpretation.text,
    surahNumber: loaded.input.surahNumber,
    tafsirAccess,
    verseNumber: loaded.input.fromVerse,
  };
});
